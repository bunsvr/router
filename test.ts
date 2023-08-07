// @ts-nocheck
function(r){r.query=r.url.indexOf('?',22);r.path=r.query===-1?r.url.substring(22):r.url.substring(22,r.query);if(r.path.length===0){if(r.method.charCodeAt(0)===71)ret
urn new Response('Hi');}switch(r.path.charCodeAt(0)){case 105:{if(r.path.indexOf('d/',1)===1){let t=3;let e=r.path.indexOf('/',t);if(e===-1){r.params={id:r.path.subst
ring(t)};{if(r.method.charCodeAt(0)===71)return c0(r);}}};break}case 106:{if(r.path.indexOf('son',1)===1){if(r.path.length===4){if(r.method.charCodeAt(0)===71)return 
c1(r);if(r.method.charCodeAt(2)===83)return r.json().then(_=>{r.data=_;return c1(r)});}return new Response('ayo wrong method lol');};break}case 97:{if(r.path.indexOf(
'pi/v1',1)===1){if(c3(r)===null)return;if(r.path.length===6){}if(r.path.charCodeAt(6)===47){if(r.path.indexOf('hi',7)===7){if(r.path.length===9){if(r.method.charCodeA
t(0)===71)return new Response('Hi');}}}};break}}let t=0;let e=r.path.indexOf('/',t);if(e===-1)return;r.params={name:r.path.substring(t,e)};if(r.path.indexOf('dashboar
d',e+1)===e+1){if(r.path.length===e+10){if(r.method.charCodeAt(0)===71)return c4(r);}}}

