import { NextRequest, NextResponse } from 'next/server';
import { dhanApiClient } from '@/lib/broker/dhan/dhanApiClient';
import { dhanAuthService } from '@/lib/services/dhanAuthService';

export const dynamic = 'force-dynamic';

async function getServerPublicIp(): Promise<string> {
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.ip) return data.ip.trim();
    }
  } catch {}

  try {
    const res = await fetch('https://icanhazip.com', {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    if (res.ok) {
      const text = await res.text();
      if (text) return text.trim();
    }
  } catch {}

  return 'UNKNOWN';
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const clientId = url.searchParams.get('clientId') || req.headers.get('client-id') || undefined;
    const accessToken = url.searchParams.get('accessToken') || req.headers.get('access-token') || undefined;

    const serverIp = await getServerPublicIp();
    const isVercel = Boolean(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV);

    const authStatus = await dhanAuthService.getAuthStatus();
    if (!authStatus.isConfigured && !accessToken) {
      return NextResponse.json({
        success: true,
        serverIp,
        isVercel,
        dhanConfig: null,
        isMatched: false,
        message: 'Server IP detected. Configure Dhan credentials to check IP whitelist status.',
      });
    }

    // Call Dhan v2 /ip/getIP via centralized client
    const dhanRes = await dhanApiClient.request('/ip/getIP', {
      method: 'GET',
      overrideClientId: clientId,
      overrideAccessToken: accessToken,
    });

    if (!dhanRes.ok) {
      return NextResponse.json({
        success: true,
        serverIp,
        isVercel,
        dhanConfig: null,
        isMatched: false,
        message: `Dhan getIP responded with ${dhanRes.status}: ${dhanRes.error || dhanRes.rawText}`,
      });
    }

    const dhanData = dhanRes.data;
    const primaryIp = dhanData?.primaryIP || null;
    const secondaryIp = dhanData?.secondaryIP || null;
    const isMatched = (primaryIp && primaryIp === serverIp) || (secondaryIp && secondaryIp === serverIp);

    return NextResponse.json({
      success: true,
      serverIp,
      isVercel,
      dhanConfig: {
        primaryIP: primaryIp,
        secondaryIP: secondaryIp,
        modifyDatePrimary: dhanData?.modifyDatePrimary || null,
        modifyDateSecondary: dhanData?.modifyDateSecondary || null,
      },
      isMatched,
      message: isMatched
        ? 'Server IP matches your whitelisted Dhan IP. Live orders are authorized.'
        : `Server IP (${serverIp}) does NOT match Dhan whitelist (Primary: ${primaryIp || 'None'}, Secondary: ${secondaryIp || 'None'}). Live orders will be rejected by Dhan with 'Invalid IP'.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `IP Status Error: ${err.message}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let { ip, ipFlag = 'PRIMARY', clientId, accessToken } = body;

    const ipToSet = ip || (await getServerPublicIp());
    if (!ipToSet || ipToSet === 'UNKNOWN') {
      return NextResponse.json(
        { success: false, message: 'Could not detect public IP to set.' },
        { status: 400 }
      );
    }

    let targetClientId = clientId;
    if (!targetClientId) {
      try {
        const auth = await dhanAuthService.getValidAccessToken();
        targetClientId = auth.clientId;
      } catch {}
    }

    const dhanPayload = {
      dhanClientId: targetClientId,
      ip: ipToSet,
      ipFlag: ipFlag.toUpperCase() === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY',
    };

    const dhanRes = await dhanApiClient.request('/ip/setIP', {
      method: 'POST',
      body: JSON.stringify(dhanPayload),
      overrideClientId: clientId,
      overrideAccessToken: accessToken,
    });

    const data = dhanRes.data;

    if (!dhanRes.ok || data?.status === 'failure') {
      const errorMsg = data?.remarks || data?.errorMessage || dhanRes.error || JSON.stringify(data || {});
      return NextResponse.json({
        success: false,
        message: `Dhan setIP Rejected: ${errorMsg}`,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully set ${dhanPayload.ipFlag} IP to ${ipToSet} on Dhan HQ!`,
      data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: `Failed to set Dhan IP: ${err.message}` },
      { status: 500 }
    );
  }
}
