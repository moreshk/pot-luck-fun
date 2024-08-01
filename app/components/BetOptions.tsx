'use client';

import { useState } from 'react';
// import { FaHandRock, FaHandPaper, FaHandScissors } from 'react-icons/fa';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmRawTransaction } from '@solana/web3.js';
import { updateRPSBet } from '../server/updateRPSBets';
import Image from 'next/image';

interface BetOptionsProps {
  betId: number;
  betAmount: number;
  potAddress: string;
  onBetPlaced: () => void;
}

export default function BetOptions({ betId, betAmount, potAddress, onBetPlaced }: BetOptionsProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<'Rock' | 'Paper' | 'Scissors' | null>(null);
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const connection = new Connection(process.env.NEXT_PUBLIC_RPC_ENDPOINT as string);

  const confirmTransaction = async (signature: string, maxRetries = 5, interval = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      const confirmation = await connection.getSignatureStatus(signature);
      if (confirmation.value?.confirmationStatus === 'confirmed' || confirmation.value?.confirmationStatus === 'finalized') {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error('Transaction confirmation timeout');
  };

  const placeBet = async (choice: 'Rock' | 'Paper' | 'Scissors') => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    setIsProcessing(true);
    setSelectedChoice(choice);

    try {
      const potPublicKey = new PublicKey(potAddress);
      const housePublicKey = new PublicKey(process.env.NEXT_PUBLIC_HOUSE_ADDRESS as string);

      const totalLamports = betAmount * 1e9; // Convert SOL to lamports
      const potLamports = Math.floor(totalLamports * 0.9); // 90% to pot
      const houseLamports = totalLamports - potLamports; // Remainder to house

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: potPublicKey,
          lamports: potLamports,
        }),
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: housePublicKey,
          lamports: houseLamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      const signedTx = await wallet.signTransaction(transaction);
      const txId = await sendAndConfirmRawTransaction(connection, signedTx.serialize(), {
        skipPreflight: true,
        commitment: 'confirmed',
        maxRetries: 5,
      });

      await confirmTransaction(txId);

      const updateResult = await updateRPSBet({
        id: betId,
        betTakerAddress: wallet.publicKey.toBase58(),
        takerSignature: txId,
        takerBet: choice,
      });

      if (updateResult.success) {
        onBetPlaced(); // This will trigger the automatic resolution in the parent component
      } else {
        console.error('Failed to update bet:', updateResult.error);
      }
    } catch (error) {
      console.error('Error placing bet:', error);
    } finally {
      setIsProcessing(false);
      setSelectedChoice(null);
    }
  };

  const handleIconClick = async (choice: 'Rock' | 'Paper' | 'Scissors') => {
    if (!wallet.connected) {
      setVisible(true); // This will open the wallet selection modal
      return;
    }
    
    await placeBet(choice);
  };

  const getButtonClass = (choice: 'Rock' | 'Paper' | 'Scissors') => {
    let baseClass = "transition-opacity ";
    if (isProcessing && selectedChoice === choice) {
      return baseClass + "opacity-100";
    } else if (isProcessing) {
      return baseClass + "opacity-50 cursor-not-allowed";
    } else {
      return baseClass + "opacity-70 hover:opacity-100 cursor-pointer";
    }
  };

  return (
    <div className="flex flex-col items-center mt-8">
  <div className="flex justify-center space-x-8 mb-4">
    <button
      onClick={() => handleIconClick('Rock')}
      disabled={isProcessing}
      className={getButtonClass('Rock')}
    >
      <Image src="/rock.png" alt="Rock" width={60} height={60} />
    </button>
    <button
      onClick={() => handleIconClick('Paper')}
      disabled={isProcessing}
      className={getButtonClass('Paper')}
    >
      <Image src="/paper.png" alt="Paper" width={60} height={60} />
    </button>
    <button
      onClick={() => handleIconClick('Scissors')}
      disabled={isProcessing}
      className={getButtonClass('Scissors')}
    >
      <Image src="/scissors.png" alt="Scissors" width={60} height={60} />
    </button>
  </div>
  {isProcessing && (
    <p className="text-yellow-400">Processing bet, please confirm the transaction in your wallet...</p>
  )}
  {!wallet.connected && (
    <p className="text-sm text-gray-400 mt-2">Click an icon to connect your wallet and place a bet</p>
  )}
</div>
  );
}