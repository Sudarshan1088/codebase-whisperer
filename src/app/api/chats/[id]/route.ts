import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDatabase, CHATS_COLLECTION, ChatThread } from '@/lib/services/db';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { db } = await connectToDatabase();
    const collection = db.collection<ChatThread>(CHATS_COLLECTION);

    const chat = await collection.findOne({ _id: id as any, userId });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    return NextResponse.json(chat);
  } catch (error: any) {
    console.error(`[Chat API] Error fetching thread:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
