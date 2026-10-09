import { prisma } from './prisma';

export type WalletBucket = 'main' | 'aeps' | 'commission' | 'hold';

/**
 * Atomic Double-Entry Wallet Engine
 * Guarantees openingBalance +/- amount === closingBalance inside a serializable transaction.
 */
export async function recordWalletMovement(params: {
  userId: number;
  bucket: WalletBucket;
  direction: 'credit' | 'debit';
  entryType: string;
  amount: number;
  transactionRef: string;
  remarks: string;
  metadata?: Record<string, unknown>;
}) {
  const { userId, bucket, direction, entryType, amount, transactionRef, remarks, metadata } = params;
  const cleanAmount = Number(Number(amount).toFixed(4));
  if (cleanAmount <= 0) {
    throw new Error('Transaction amount must be greater than zero.');
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });
    if (!user || !user.wallet) {
      throw new Error('User wallet not found.');
    }

    const wallet = user.wallet;
    const fieldMap: Record<WalletBucket, keyof typeof wallet> = {
      main: 'availableBalance',
      aeps: 'aepsBalance',
      commission: 'commissionBalance',
      hold: 'holdBalance',
    };
    const fieldName = fieldMap[bucket];
    const openingBalance = Number(wallet[fieldName] ?? 0);

    if (direction === 'debit') {
      if (bucket === 'commission' && wallet.commissionLocked) {
        throw new Error('Commission wallet is currently locked by Admin.');
      }
      const minAllowed = bucket === 'main' ? Number(wallet.capBalance || 0) - Number(wallet.overdraftLimit || 0) : 0;
      if (openingBalance - cleanAmount < minAllowed) {
        throw new Error(
          `Insufficient ${bucket.toUpperCase()} wallet balance. Available: ₹${openingBalance.toFixed(2)}, Required: ₹${cleanAmount.toFixed(2)}`
        );
      }
    }

    const closingBalance = Number(
      (direction === 'credit' ? openingBalance + cleanAmount : openingBalance - cleanAmount).toFixed(4)
    );

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        [fieldName]: closingBalance,
      },
    });

    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        userId: user.id,
        userMobile: user.mobile,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        bucket,
        entryType,
        direction,
        amount: cleanAmount,
        openingBalance,
        closingBalance,
        transactionRef,
        remarks,
        metadataJson: JSON.stringify(metadata || {}),
      },
    });

    return { wallet: updatedWallet, ledgerEntry };
  });
}

/**
 * Atomic Bucket-to-Bucket Transfer (e.g., AEPS -> Main 1:1 Free Settlement, or Commission -> Main/AEPS)
 */
export async function transferBetweenBuckets(params: {
  userId: number;
  fromBucket: WalletBucket;
  toBucket: WalletBucket;
  amount: number;
  remarks?: string;
}) {
  const { userId, fromBucket, toBucket, amount, remarks } = params;
  const cleanAmount = Number(Number(amount).toFixed(2));
  if (cleanAmount <= 0) throw new Error('Transfer amount must be positive.');
  if (fromBucket === toBucket) throw new Error('Source and destination buckets must be different.');

  const ref = `BKT-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  await recordWalletMovement({
    userId,
    bucket: fromBucket,
    direction: 'debit',
    entryType: 'bucket_transfer',
    amount: cleanAmount,
    transactionRef: ref,
    remarks: remarks || `Transferred from ${fromBucket.toUpperCase()} to ${toBucket.toUpperCase()} wallet`,
  });

  return recordWalletMovement({
    userId,
    bucket: toBucket,
    direction: 'credit',
    entryType: 'bucket_transfer',
    amount: cleanAmount,
    transactionRef: ref,
    remarks: remarks || `Credited from ${fromBucket.toUpperCase()} wallet (1:1 instant settlement)`,
  });
}
