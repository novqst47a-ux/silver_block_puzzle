const prefix="hanjul:"+self.registration.scope+":";
const cacheName=prefix+"7";
const files=["./","./index.html","./style.css","./storage.js","./rules.js","./portraits.js","./game.js","./install.js",
  "./manifest.webmanifest","./icon.svg","./icons/icon-192.png","./icons/icon-512.png","./icons/apple-touch.png"];
self.addEventListener("install",e=>e.waitUntil(caches.open(cacheName).then(c=>c.addAll(files))));
self.addEventListener("activate",e=>e.waitUntil((async()=>{
  for(const k of await caches.keys()) if(k.startsWith(prefix)&&k!==cacheName)await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET"||!e.request.url.startsWith(self.registration.scope))return;
  e.respondWith((async()=>{
    const c=await caches.open(cacheName);
    const hit=await c.match(e.request);
    if(hit)return hit;
    if(e.request.mode==="navigate")return (await c.match("./index.html"))||fetch(e.request);
    return fetch(e.request);
  })());
});
