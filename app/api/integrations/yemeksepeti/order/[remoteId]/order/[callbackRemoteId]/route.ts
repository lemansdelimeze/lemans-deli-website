import { NextRequest, NextResponse } from "next/server";
import { POST as receiveOrder } from "../../route";

/** Delivery Hero may append the remote id twice when composing the plugin URL. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ remoteId: string; callbackRemoteId: string }> }
) {
  const { remoteId, callbackRemoteId } = await context.params;

  if (remoteId !== callbackRemoteId) {
    return NextResponse.json(
      { reason: "INVALID_REQUEST", message: "Remote ID eşleşmiyor." },
      { status: 400 }
    );
  }

  return receiveOrder(request, { params: Promise.resolve({ remoteId }) });
}
