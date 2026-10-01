import { NextRequest, NextResponse } from 'next/server';
import { DHAN_BASE_URL } from '@/lib/broker/dhan/dhanConstants';
import { getActiveBrokerCredentials } from '@/lib/services/brokerVaultService';

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
    let clientId = url.searchParams.get('clientId') || req.headers.get('client-id') || '';
    let accessToken = url.searchParams.get('accessToken') || req.headers.get('access-token') || '';

    if (!clientId || !accessToken) {
      const vault = await getActiveBrokerCredentials();
      clientId = clientId || vault.clientId;
      accessToken = accessToken || vault.accessToken;
    }

    const serverIp = await getServerPublicIp();
    const isVercel = Boolean(process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV);

    if (!accessToken) {
      return NextResponse.json({
        success: true,
        serverIp,
        isVercel,
        dhanConfig: null,
        isMatched: false,
        message: 'Server IP detected. Configure Dhan credentials to check IP whitelist status.',
      });
    }

    // Call Dhan v2 /ip/getIP
    const dhanRes = await fetch(`${DHAN_BASE_URL}/ip/getIP`, {
      method: 'GET',
      headers: {
        'access-token': accessToken,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!dhanRes.ok) {
      const errText = await dhanRes.text();
      return NextResponse.json({
        success: true,
        serverIp,
        isVercel,
        dhanConfig: null,
        isMatched: false,
        message: `Dhan getIP responded with ${dhanRes.status}: ${errText}`,
      });
    }

    const dhanData = await dhanRes.json();
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
    const body = await req.json();
    let { ip, ipFlag = 'PRIMARY', clientId, accessToken } = body;

    if (!clientId || !accessToken) {
      const vault = await getActiveBrokerCredentials();
      clientId = clientId || vault.clientId;
      accessToken = accessToken || vault.accessToken;
    }

    if (!clientId || !accessToken) {
      return NextResponse.json(
        { success: false, message: 'Dhan Client ID and Access Token are required.' },
        { status: 400 }
      );
    }

    const ipToSet = ip || (await getServerPublicIp());
    if (!ipToSet || ipToSet === 'UNKNOWN') {
      return NextResponse.json(
        { success: false, message: 'Could not detect public IP to set.' },
        { status: 400 }
      );
    }

    const dhanPayload = {
      dhanClientId: clientId,
      ip: ipToSet,
      ipFlag: ipFlag.toUpperCase() === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY',
    };

    const dhanRes = await fetch(`${DHAN_BASE_URL}/ip/setIP`, {
      method: 'POST',
      headers: {
        'access-token': accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(dhanPayload),
    });

    const data = await dhanRes.json();

    if (!dhanRes.ok || data.status === 'failure') {
      const errorMsg = data.remarks || data.errorMessage || JSON.stringify(data);
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
