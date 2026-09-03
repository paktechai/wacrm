import { NextResponse } from 'next/server';

import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { writeTenantAudit } from '@/lib/audit/tenant';
import { validateWidgetDraft } from '@/lib/webchat/widget-validation';

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('viewer');
    const { data, error } = await supabase
      .from('webchat_widgets')
      .select(
        'id, public_key, name, welcome_message, allowed_origins, is_active, created_at, updated_at'
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ widgets: data ?? [] });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin');
    const body = await request.json();
    const validation = validateWidgetDraft({
      name: body?.name,
      welcomeMessage: body?.welcomeMessage,
      allowedOrigins: body?.allowedOrigins,
    });
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: 'Check the highlighted widget fields',
          fields: validation.errors,
        },
        { status: 400 }
      );
    }

    const { data: widget, error } = await supabase
      .from('webchat_widgets')
      .insert({
        account_id: accountId,
        created_by: userId,
        name: validation.value.name,
        welcome_message: validation.value.welcomeMessage,
        allowed_origins: validation.value.allowedOrigins,
      })
      .select(
        'id, public_key, name, welcome_message, allowed_origins, is_active, created_at, updated_at'
      )
      .single();
    if (error) throw error;

    void writeTenantAudit({
      accountId,
      actorUserId: userId,
      event: 'webchat.widget.created',
      objectType: 'webchat_widget',
      objectId: widget.id,
      metadata: { name: widget.name },
    });
    return NextResponse.json({ widget }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
