import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeHttps(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { productId } = await params;
    if (!productId) return new NextResponse(null, { status: 404 });

    const supabase = await createClient();
    const { data: image, error } = await supabase
      .from("product_images")
      .select("storage_path,source_url")
      .eq("product_id", productId)
      .eq("approved", true)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();

    if (error || !image) return new NextResponse(null, { status: 404 });

    if (image.storage_path) {
      try {
        const { data, error: signError } = await supabase.storage
          .from("product-images")
          .createSignedUrl(image.storage_path, 3600);
        if (!signError && data?.signedUrl) {
          return NextResponse.redirect(data.signedUrl, 307);
        }
      } catch {
        // Tenta a URL de origem abaixo.
      }
    }

    const fallback = safeHttps(image.source_url);
    if (fallback) return NextResponse.redirect(fallback, 307);

    return new NextResponse(null, { status: 404 });
  } catch (error) {
    console.error("product-image proxy failed", error);
    return new NextResponse(null, { status: 404 });
  }
}
