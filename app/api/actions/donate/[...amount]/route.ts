import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
} from "@solana/actions";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

  const RECIPIENT_ADDRESS = "9wPKJm8rVXURCRJKEVJqLXW4PZSvLTUXb48t3Fn4Yvyh";
  
  export async function GET(req: Request) {
    const payload: ActionGetResponse = {
      title: "Donate SOL",
      icon: "https://cryptologos.cc/logos/solana-sol-logo.png",
      description: "Donate SOL to support our project",
      label: "Donate",
      links: {
        actions: [
          {
            href: "/api/actions/donate/{amount}",
            label: "Donate",
            parameters: [
              {
                name: "amount",
                label: "Enter SOL amount",
              },
            ],
          },
        ],
      },
    };
    return new Response(JSON.stringify(payload), {
      headers: {
        ...ACTIONS_CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }
  export async function POST(req: Request) {
    try {
      const body: ActionPostRequest = await req.json();
      const { account } = body;
      const url = new URL(req.url);
      const amount = parseFloat(url.pathname.split('/').pop() || '0') * 1e9; // Convert SOL to lamports
  
      const connection = new Connection("https://api.mainnet-beta.solana.com");
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(account),
          toPubkey: new PublicKey(RECIPIENT_ADDRESS),
          lamports: amount,
        })
      );
  
      const payload: ActionPostResponse = await createPostResponse({
        fields: {
            transaction: transaction,
            message: `Donating ${amount / 1e9} SOL`,
        },
    });
  
      return new Response(JSON.stringify(payload), {
        headers: {
          ...ACTIONS_CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error in POST handler:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: {
          ...ACTIONS_CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      });
    }
  }