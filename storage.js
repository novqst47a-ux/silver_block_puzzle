"use strict";

function gameStorageKey(prefix,version){
  const base=new URL(".",location.href);
  const key=prefix+":"+base.pathname+":"+version;
  const previous=prefix+":"+new URL("docs/",base).pathname+":"+version;
  try{
    // Reuse the existing album in place, even when it fills the storage quota.
    if(localStorage.getItem(key)===null && localStorage.getItem(previous)!==null)return previous;
  }catch{ /* Game and album readers handle unavailable storage. */ }
  return key;
}
