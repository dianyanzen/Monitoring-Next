require('@next/env').loadEnvConfig(process.cwd());
require('./pdak-ts-loader.cjs');
const Module=require('node:module'),original=Module._load;
Module._load=function(n,...args){return n==='server-only'?{}:original.call(this,n,...args);};
const {getOracleConnection}=require('../src/lib/oracle.ts');
(async()=>{
 for(const alias of [...new Set(['DB',process.env.DB_ALIAS_BARANG??process.env.DB_ALIAS_PRR??'DB222'])]){
  let conn;
  try{
   conn=await getOracleConnection(alias); conn.callTimeout=15000;
   const query=async(sql,binds={})=>(await conn.execute(sql,binds)).rows;
   console.log(JSON.stringify({alias,columns:await query("SELECT TABLE_NAME,COLUMN_NAME,DATA_TYPE,DATA_LENGTH,NULLABLE FROM ALL_TAB_COLUMNS WHERE OWNER=USER AND TABLE_NAME IN ('SIAK_MASTER_BARANG','SIAK_BARANG_MASUK','SIAK_BARANG_KELUAR','SIAK_MASTER_ASET','SIAK_MONEV_WILAYAH') ORDER BY TABLE_NAME,COLUMN_ID")}));
   if(alias==='DB') console.log(JSON.stringify({menus:await query("SELECT DISTINCT URL,TITLE,USER_LEVEL,IS_ACTIVE FROM VW_SIAK_MENU WHERE LOWER(URL) LIKE :path ORDER BY URL,USER_LEVEL",{path:'%barang%'}),targets:await query("SELECT SYSTEM_CODE,SYSTEM_VALUE_NUM FROM SIAK_MASTER WHERE SYSTEM_TYPE=:type",{type:'SET_DASHBOARD'})}));
  }catch(e){console.log(JSON.stringify({alias,error:e.code??e.name}));}finally{if(conn)await conn.close();}
 }
})().catch(()=>{process.exitCode=1;});
