'use client';

import { useState } from 'react';
import { decryptBet } from '../server/sol/decryptBet';
import Navbar from '../components/Navbar';

export default function DecryptBetTest() {
  const [encryptedBet, setEncryptedBet] = useState('');
  const [decryptedBet, setDecryptedBet] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState('');

  const handleDecrypt = async () => {
    setIsDecrypting(true);
    setError('');
    setDecryptedBet('');

    try {
      const result = await decryptBet(encryptedBet);
      setDecryptedBet(result);
    } catch (err) {
      setError('Failed to decrypt bet. Please check the encrypted bet and try again.');
      console.error(err);
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Navbar />
      <main className="flex-grow flex flex-col items-center justify-center p-4">
        <div className="bg-white shadow-md rounded-lg p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Decrypt Bet Test</h1>
          <div className="space-y-4">
            <input
              type="text"
              value={encryptedBet}
              onChange={(e) => setEncryptedBet(e.target.value)}
              placeholder="Enter encrypted bet"
              className="w-full p-3 border border-gray-300 rounded-md text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleDecrypt}
              disabled={isDecrypting || !encryptedBet}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-200"
            >
              {isDecrypting ? 'Decrypting...' : 'Decrypt Bet'}
            </button>
            {decryptedBet && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                <h2 className="font-bold text-green-800 mb-2">Decrypted Bet:</h2>
                <p className="break-all text-green-700">{decryptedBet}</p>
              </div>
            )}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}