// src/app/api/Activity/do_save/route.ts
import { NextResponse } from "next/server";
import { lgn_check_user, lgn_change_pwd, md5 } from "@/lib/auth"; // dari jawaban sebelumnya
import { readServerSession } from "@/lib/session";

type ReqBody = {
  user_name?: string;
  old_password?: string;
  new_password?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ReqBody;

  // ambil user dari session (S_USER_ID), kalau kosong pakai body.user_name (kompat lama)
  const sess = await readServerSession();
  const user_name = (sess?.S_USER_ID || body.user_name || "").trim();
  const old_password = (body.old_password || "").trim();
  const new_password = (body.new_password || "").trim();

  if (!user_name) {
    return NextResponse.json({
      message_type: 0,
      message: "Sorry User  Not Found, Please Contact Admin For Registration",
    }, { status: 400 });
  }
  if (!old_password || !new_password) {
    return NextResponse.json({
      message_type: 0,
      message: "Old Password / New Password Cannot Be Empty !",
    }, { status: 400 });
  }

  const r = await lgn_check_user(user_name);
  if (!r) {
    return NextResponse.json({
      message_type: 0,
      message: `Sorry User ${user_name} Not Found, Please Contact Admin For Registration`,
    }, { status: 404 });
  }

  const old_md5 = md5(old_password);
  const new_md5 = md5(new_password);

  if (r.USER_PWD !== old_md5) {
    return NextResponse.json({
      message_type: 0,
      message: `Old Password Incorect For User ${user_name} Please Try Again`,
    }, { status: 400 });
  }

  const changed = await lgn_change_pwd(user_name, new_md5);
  if (changed > 0) {
    return NextResponse.json({
      message_type: 1,
      message: "Your Password Has Been Changed Successfully! Thank you.",
    });
  }
  return NextResponse.json({
    message_type: 0,
    message: "Update failed",
  }, { status: 500 });
}
