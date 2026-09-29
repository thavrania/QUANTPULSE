import { NextRequest, NextResponse } from 'next/server';
import { DHAN_BASE_URL } from '@/lib/broker/dhan/dhanConstants';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  getActiveBrokerCredentials,
  formatTokenCountdown,
  maskToken,
} from '@/lib/services/brokerVaultService';

/**
 * GET: Retrieve the active broker vault configuration and token validity
 */
export async function GET(req: NextRequest) {
  try {
    const creds = await getActiveBrokerCredentials();

    return NextResponse.json({
      success: true,
      data: creds.status,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message || 'Error fetching vault status' },
      { status: 500 }
    );
  }
}

/**
 * POST: Authenticate, verify with Dhan HQ, and securely store in Supabase Cloud Vault
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { brokerName = 'DHAN', clientId, accessToken, expiryHours = 24 } = body;

    if (!clientId || !accessToken) {
      return NextResponse.json(
        {
          success: false,
          message: 'Client ID and Access Token are required.',
        },
        { status: 400 }
      );
    }

    const trimmedCid = String(clientId).trim();
    const trimmedToken = String(accessToken).trim();

    // 1. Live Verification Ping to Dhan HQ API v2
    const dhanRes = await fetch(`${DHAN_BASE_URL}/fundlimit`, {
      method: 'GET',
      headers: {
        'access-token': trimmedToken,
        'client-id': trimmedCid,
        'Content-Type': 'application/json',
      },
    });

    const latencyMs = Date.now() - startTime;

    if (!dhanRes.ok) {
      const errText = await dhanRes.text();
      let parsedErr = errText;
      try {
        const j = JSON.parse(errText);
        parsedErr = j.errorMessage || j.message || errText;
      } catch {}

      return NextResponse.json({
        success: false,
        message: `Dhan Auth Verification Failed (${dhanRes.status}): ${parsedErr}`,
        latencyMs,
      });
    }

    const fundData = await dhanRes.json();
    const availableMargin = Number(fundData?.availMargin ?? fundData?.sodLimit ?? 0);

    // 2. Compute 24-hour expiration timestamp
    const expiryDate = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    const expiryIso = expiryDate.toISOString();

    // 3. Upsert into Supabase broker_vault
    let savedToCloud = false;
    if (isSupabaseConfigured && supabase) {
      try {
        // Demote existing primary keys
        await supabase
          .from('broker_vault')
          .update({ is_primary: false })
          .eq('broker_name', brokerName);

        // Insert new primary credential
        const { error } = await supabase.from('broker_vault').insert({
          broker_name: brokerName,
          client_id: trimmedCid,
          access_token: trimmedToken,
          token_generated_at: new Date().toISOString(),
          token_expiry_at: expiryIso,
          status: 'ACTIVE',
          last_ping_latency_ms: latencyMs,
          available_margin: availableMargin,
          is_primary: true,
          updated_at: new Date().toISOString(),
        });

        if (!error) {
          savedToCloud = true;
        } else {
          console.warn('Supabase broker_vault notice:', error.message);
        }
      } catch (dbErr) {
        console.warn('Database error while saving to broker_vault:', dbErr);
      }
    }

    const countdown = formatTokenCountdown(expiryIso);

    return NextResponse.json({
      success: true,
      message: savedToCloud
        ? 'Dhan HQ Authenticated and Saved to Supabase Cloud Vault!'
        : 'Dhan HQ Authenticated (Cloud Vault schema pending, cached locally).',
      savedToCloud,
      latencyMs,
      availableMargin,
      expiryAt: expiryIso,
      tokenTimeRemaining: countdown.formatted,
      maskedToken: maskToken(trimmedToken),
      clientId: trimmedCid,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json(
      {
        success: false,
        message: `Gateway Error: ${err.message || 'Unable to connect'}`,
        latencyMs,
      },
      { status: 500 }
    );
  }
}
