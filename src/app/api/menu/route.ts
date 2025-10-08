import { NextResponse } from "next/server";
import { getOracleConnection } from "@/lib/oracle";

// ✅ Fungsi recursive ambil sub-menu (seperti Shr::get_sub_menu)
async function getSubMenus(connection: any, parentId: number, userLevel: number) {
  const result = await connection.execute(
    `SELECT MENU_ID, PARENT_ID, ICON, TITLE, URL, IS_ACTIVE, USER_LEVEL, MENU_LEVEL, IS_NEXT
     FROM VW_SIAK_MENU
     WHERE USER_LEVEL = :user_level
       AND PARENT_ID = :parent_id
       AND ACTIVE_MENU = 1
       AND IS_NEXT = 1
     ORDER BY LEVEL_HEAD, LEVEL_SUB, LEVEL_CONTENT, TITLE`,
    { user_level: userLevel, parent_id: parentId }
  );

  const subMenus = result.rows || [];

  for (const item of subMenus) {
    // Recursive — hanya ambil sub-submenu bila IS_ACTIVE != 1
    if (item.IS_ACTIVE !== 1) {
      item.SUB_MENU = await getSubMenus(connection, item.MENU_ID, userLevel);
    }
  }

  return subMenus;
}

export async function GET() {
  const userLevel = 5; // ✅ hardcoded sesuai permintaan kamu

  let connection;
  try {
    connection = await getOracleConnection();

    // ✅ Ambil menu utama (MENU_LEVEL = 1)
    const result = await connection.execute(
      `SELECT MENU_ID, PARENT_ID, ICON, TITLE, URL, IS_ACTIVE, USER_LEVEL, MENU_LEVEL, IS_NEXT
       FROM VW_SIAK_MENU
       WHERE USER_LEVEL = :user_level
         AND MENU_LEVEL = 1
         AND ACTIVE_MENU = 1
         AND IS_NEXT = 1
       ORDER BY LEVEL_HEAD, LEVEL_SUB, LEVEL_CONTENT, TITLE`,
      { user_level: userLevel }
    );

    const menus = result.rows || [];

    // Ambil sub-menu untuk setiap menu utama
    for (const item of menus) {
      item.SUB_MENU = await getSubMenus(connection, item.MENU_ID, userLevel);
    }

    return NextResponse.json(menus);
  } catch (error: any) {
    console.error("❌ API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error("⚠️ Failed to close connection:", closeErr);
      }
    }
  }
}
