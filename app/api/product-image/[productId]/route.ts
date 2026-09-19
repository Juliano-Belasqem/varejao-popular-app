import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {downloadRemoteImage} from "@/lib/remote-image";

export async function GET(_request:Request,{params}:{params:Promise<{productId:string}>}){
  const {productId}=await params;
  const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
  if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(productId))return new NextResponse(null,{status:400,headers});
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return new NextResponse(null,{status:401,headers});
  const {data:profile}=await supabase.from("profiles").select("active").eq("id",user.id).single();
  if(!profile?.active)return new NextResponse(null,{status:403,headers});
  const {data:images,error}=await supabase.from("product_images").select("storage_path,source_url").eq("product_id",productId).eq("approved",true).order("is_primary",{ascending:false}).order("created_at",{ascending:false}).limit(5);
  if(error)return new NextResponse(null,{status:503,headers});
  for(const image of images??[]){
    if(image.storage_path){
      const {data}=await supabase.storage.from("product-images").download(image.storage_path);
      if(data&&["image/png","image/jpeg","image/webp"].includes(data.type)&&data.size<=8*1024*1024)return new NextResponse(data,{headers:{...headers,"Content-Type":data.type}});
    }
    if(image.source_url){
      try{const result=await downloadRemoteImage(image.source_url);return new NextResponse(new Uint8Array(result.bytes),{headers:{...headers,"Content-Type":result.contentType}})}catch{/* Try the next approved image. */}
    }
  }
  return new NextResponse(null,{status:404,headers});
}
