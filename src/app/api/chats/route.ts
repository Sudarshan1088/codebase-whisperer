import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDatabase, CHATS_COLLECTION, ChatThread } from '@/lib/services/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection<ChatThread>(CHATS_COLLECTION);

    // Retrieve all chats for this user, excluding the bulky messages array
    const chats = await collection
      .find({ userId })
      .project({ _id: 1, repoId: 1, title: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .toArray();

    return NextResponse.json(chats);
  } catch (error: any) {
    console.error('[Chats API] Error fetching history:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
