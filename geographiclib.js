/*
 * Geodesic routines from GeographicLib translated to JavaScript.  See
 * http://geographiclib.sf.net/html/other.html#javascript
 *
 * The algorithms are derived in
 *
 *    Charles F. F. Karney,
 *    Algorithms for geodesics, J. Geodesy 87, 43-55 (2013),
 *    https://dx.doi.org/10.1007/s00190-012-0578-z
 *    Addenda: http://geographiclib.sf.net/geod-addenda.html
 *
 * This file is the concatenation and compression of the JavaScript files in
 * doc/scripts/GeographicLib in the source tree for GeographicLib.
 *
 * Copyright (c) Charles Karney (2011-2015) <charles@karney.com> and licensed
 * under the MIT/X11 License.  For more information, see
 * http://geographiclib.sf.net/
 *
 * Version: 1.45
 * File inventory:
 *   Math.js Geodesic.js GeodesicLine.js PolygonArea.js DMS.js
 */
// GeographicLib/Math.js
var GeographicLib={};
GeographicLib.Constants={};
GeographicLib.Math={};
GeographicLib.Accumulator={};
(function(
c){
"use strict";
c.WGS84={a:6378137,f:1/298.257223563};
c.version={major:1,minor:44,patch:0};
c.version_string="1.45";
})(GeographicLib.Constants);
(function(
m){
"use strict";
m.digits=53;
m.epsilon=Math.pow(0.5,m.digits-1);
m.degree=Math.PI/180;
m.sq=function(x){return x*x;};
m.hypot=function(x,y){
var a,b;
x=Math.abs(x);
y=Math.abs(y);
a=Math.max(x,y);b=Math.min(x,y)/(a?a:1);
return a*Math.sqrt(1+b*b);
};
m.cbrt=function(x){
var y=Math.pow(Math.abs(x),1/3);
return x<0?-y:y;
};
m.log1p=function(x){
var y=1+x,
z=y-1;
return z===0?x:x*Math.log(y)/z;
};
m.atanh=function(x){
var y=Math.abs(x);
y=m.log1p(2*y/(1-y))/2;
return x<0?-y:y;
};
m.sum=function(u,v){
var s=u+v,
up=s-v,
vpp=s-up,
t;
up-=u;
vpp-=v;
t=-(up+vpp);
return{s:s,t:t};
};
m.polyval=function(N,p,s,x){
var y=N<0?0:p[s++];
while(--N>=0)y=y*x+p[s++];
return y;
};
m.AngRound=function(x){
var z=1/16,
y=Math.abs(x);
y=y<z?z-(z-y):y;
return x<0?0-y:y;
};
m.AngNormalize=function(x){
x=x%360;
return x<-180?x+360:(x<180?x:x-360);
};
m.LatFix=function(x){
return Math.abs(x)>90?Number.NaN:x;
};
m.AngDiff=function(x,y){
var r=m.sum(m.AngNormalize(x),m.AngNormalize(-y)),
d=-m.AngNormalize(r.s),
t=r.t;
return(d==180&&t<0?-180:d)-t;
};
m.sincosd=function(x){
var r,q,s,c,sinx,cosx;
r=x%360;
q=Math.floor(r/90+0.5);
r-=90*q;
r*=this.degree;
s=Math.sin(r);c=Math.cos(r);
switch(q&3){
case 0:sinx=s;cosx=c;break;
case 1:sinx=c;cosx=0-s;break;
case 2:sinx=0-s;cosx=0-c;break;
default:sinx=0-c;cosx=s;break;
}
return{s:sinx,c:cosx};
};
m.atan2d=function(y,x){
var q=0,t,ang;
if(Math.abs(y)>Math.abs(x)){t=x;x=y;y=t;q=2;}
if(x<0){x=-x;++q;}
ang=Math.atan2(y,x)/this.degree;
switch(q){
case 1:ang=(y>0?180:-180)-ang;break;
case 2:ang=90-ang;break;
case 3:ang=-90+ang;break;
}
return ang;
};
})(GeographicLib.Math);
(function(
a,m){
"use strict";
a.Accumulator=function(y){
this.Set(y);
};
a.Accumulator.prototype.Set=function(y){
if(!y)y=0;
if(y.constructor===a.Accumulator){
this._s=y._s;
this._t=y._t;
}else{
this._s=y;
this._t=0;
}
};
a.Accumulator.prototype.Add=function(y){
var u=m.sum(y,this._t),
v=m.sum(u.s,this._s);
u=u.t;
this._s=v.s;
this._t=v.t;
if(this._s===0)
this._s=u;
else
this._t+=u;
};
a.Accumulator.prototype.Sum=function(y){
var b;
if(!y)
return this._s;
else{
b=new a.Accumulator(this);
b.Add(y);
return b._s;
}
};
a.Accumulator.prototype.Negate=function(){
this._s*=-1;
this._t*=-1;
};
})(GeographicLib.Accumulator,GeographicLib.Math);
// GeographicLib/Geodesic.js
GeographicLib.Geodesic={};
GeographicLib.GeodesicLine={};
GeographicLib.PolygonArea={};
(function(
g,l,p,m,c){
"use strict";
var GEOGRAPHICLIB_GEODESIC_ORDER=6,
nA1_=GEOGRAPHICLIB_GEODESIC_ORDER,
nA2_=GEOGRAPHICLIB_GEODESIC_ORDER,
nA3_=GEOGRAPHICLIB_GEODESIC_ORDER,
nA3x_=nA3_,
nC3x_,nC4x_,
maxit1_=20,
maxit2_=maxit1_+m.digits+10,
tol0_=m.epsilon,
tol1_=200*tol0_,
tol2_=Math.sqrt(tol0_),
tolb_=tol0_*tol1_,
xthresh_=1000*tol2_,
CAP_NONE=0,
CAP_ALL=0x1F,
CAP_MASK=CAP_ALL,
OUT_ALL=0x7F80,
Astroid,
A1m1f_coeff,C1f_coeff,C1pf_coeff,
A2m1f_coeff,C2f_coeff,
A3_coeff,C3_coeff,C4_coeff;
g.tiny_=Math.sqrt(Number.MIN_VALUE);
g.nC1_=GEOGRAPHICLIB_GEODESIC_ORDER;
g.nC1p_=GEOGRAPHICLIB_GEODESIC_ORDER;
g.nC2_=GEOGRAPHICLIB_GEODESIC_ORDER;
g.nC3_=GEOGRAPHICLIB_GEODESIC_ORDER;
g.nC4_=GEOGRAPHICLIB_GEODESIC_ORDER;
nC3x_=(g.nC3_*(g.nC3_-1))/2;
nC4x_=(g.nC4_*(g.nC4_+1))/2,
g.CAP_C1=1<<0;
g.CAP_C1p=1<<1;
g.CAP_C2=1<<2;
g.CAP_C3=1<<3;
g.CAP_C4=1<<4;
g.NONE=0;
g.LATITUDE=1<<7|CAP_NONE;
g.LONGITUDE=1<<8|g.CAP_C3;
g.AZIMUTH=1<<9|CAP_NONE;
g.DISTANCE=1<<10|g.CAP_C1;
g.STANDARD=g.LATITUDE|g.LONGITUDE|g.AZIMUTH|g.DISTANCE;
g.DISTANCE_IN=1<<11|g.CAP_C1|g.CAP_C1p;
g.REDUCEDLENGTH=1<<12|g.CAP_C1|g.CAP_C2;
g.GEODESICSCALE=1<<13|g.CAP_C1|g.CAP_C2;
g.AREA=1<<14|g.CAP_C4;
g.ALL=OUT_ALL|CAP_ALL;
g.LONG_UNROLL=1<<15;
g.OUT_MASK=OUT_ALL|g.LONG_UNROLL;
g.SinCosSeries=function(sinp,sinx,cosx,c){
var k=c.length,
n=k-(sinp?1:0),
ar=2*(cosx-sinx)*(cosx+sinx),
y0=n&1?c[--k]:0,y1=0;
n=Math.floor(n/2);
while(n--){
y1=ar*y0-y1+c[--k];
y0=ar*y1-y0+c[--k];
}
return(sinp?2*sinx*cosx*y0:
cosx*(y0-y1));
};
Astroid=function(x,y){
var k,
p=m.sq(x),
q=m.sq(y),
r=(p+q-1)/6,
S,r2,r3,disc,u,T3,T,ang,v,uv,w;
if(!(q===0&&r<=0)){
S=p*q/4;
r2=m.sq(r);
r3=r*r2
disc=S*(S+2*r3);
u=r;
if(disc>=0){
T3=S+r3;
T3+=T3<0?-Math.sqrt(disc):Math.sqrt(disc);
T=m.cbrt(T3);
u+=T+(T!==0?r2/T:0);
}else{
ang=Math.atan2(Math.sqrt(-disc),-(S+r3));
u+=2*r*Math.cos(ang/3);
}
v=Math.sqrt(m.sq(u)+q);
uv=u<0?q/(v-u):u+v;
w=(uv-q)/(2*v);
k=uv/(Math.sqrt(uv+m.sq(w))+w);
}else{
k=0;
}
return k;
};
A1m1f_coeff=[
+1,4,64,0,256,
];
g.A1m1f=function(eps){
var p=Math.floor(nA1_/2),
t=m.polyval(p,A1m1f_coeff,0,m.sq(eps))/A1m1f_coeff[p+1];
return(t+eps)/(1-eps);
};
C1f_coeff=[
-1,6,-16,32,
-9,64,-128,2048,
+9,-16,768,
+3,-5,512,
-7,1280,
-7,2048,
];
g.C1f=function(eps,c){
var eps2=m.sq(eps),
d=eps,
o=0,
l,p;
for(l=1;l<=g.nC1_;++l){
p=Math.floor((g.nC1_-l)/2);
c[l]=d*m.polyval(p,C1f_coeff,o,eps2)/C1f_coeff[o+p+1];
o+=p+2;
d*=eps;
}
};
C1pf_coeff=[
+205,-432,768,1536,
+4005,-4736,3840,12288,
-225,116,384,
-7173,2695,7680,
+3467,7680,
+38081,61440,
];
g.C1pf=function(eps,c){
var eps2=m.sq(eps),
d=eps,
o=0,
l,p;
for(l=1;l<=g.nC1p_;++l){
p=Math.floor((g.nC1p_-l)/2);
c[l]=d*m.polyval(p,C1pf_coeff,o,eps2)/C1pf_coeff[o+p+1];
o+=p+2;
d*=eps;
}
};
A2m1f_coeff=[
-11,-28,-192,0,256,
];
g.A2m1f=function(eps){
var p=Math.floor(nA2_/2),
t=m.polyval(p,A2m1f_coeff,0,m.sq(eps))/A2m1f_coeff[p+1];
return(t-eps)/(1+eps);
};
C2f_coeff=[
+1,2,16,32,
+35,64,384,2048,
+15,80,768,
+7,35,512,
+63,1280,
+77,2048,
];
g.C2f=function(eps,c){
var eps2=m.sq(eps),
d=eps,
o=0,
l,p;
for(l=1;l<=g.nC2_;++l){
p=Math.floor((g.nC2_-l)/2);
c[l]=d*m.polyval(p,C2f_coeff,o,eps2)/C2f_coeff[o+p+1];
o+=p+2;
d*=eps;
}
};
g.Geodesic=function(a,f){
this.a=a;
this.f=f;
this._f1=1-this.f;
this._e2=this.f*(2-this.f);
this._ep2=this._e2/m.sq(this._f1);
this._n=this.f/(2-this.f);
this._b=this.a*this._f1;
this._c2=(m.sq(this.a)+m.sq(this._b)*
(this._e2===0?1:
(this._e2>0?m.atanh(Math.sqrt(this._e2)):
Math.atan(Math.sqrt(-this._e2)))/
Math.sqrt(Math.abs(this._e2))))/2;
this._etol2=0.1*tol2_/
Math.sqrt(Math.max(0.001,Math.abs(this.f))*
Math.min(1.0,1-this.f/2)/2);
if(!(isFinite(this.a)&&this.a>0))
throw new Error("Major radius is not positive");
if(!(isFinite(this._b)&&this._b>0))
throw new Error("Minor radius is not positive");
this._A3x=new Array(nA3x_);
this._C3x=new Array(nC3x_);
this._C4x=new Array(nC4x_);
this.A3coeff();
this.C3coeff();
this.C4coeff();
};
A3_coeff=[
-3,128,
-2,-3,64,
-1,-3,-1,16,
+3,-1,-2,8,
+1,-1,2,
+1,1,
];
g.Geodesic.prototype.A3coeff=function(){
var o=0,k=0,
j,p;
for(j=nA3_-1;j>=0;--j){
p=Math.min(nA3_-j-1,j);
this._A3x[k++]=m.polyval(p,A3_coeff,o,this._n)
/A3_coeff[o+p+1];
o+=p+2;
}
};
C3_coeff=[
+3,128,
+2,5,128,
-1,3,3,64,
-1,0,1,8,
-1,1,4,
+5,256,
+1,3,128,
-3,-2,3,64,
+1,-3,2,32,
+7,512,
-10,9,384,
+5,-9,5,192,
+7,512,
-14,7,512,
+21,2560,
];
g.Geodesic.prototype.C3coeff=function(){
var o=0,k=0,
l,j,p;
for(l=1;l<g.nC3_;++l){
for(j=g.nC3_-1;j>=l;--j){
p=Math.min(g.nC3_-j-1,j);
this._C3x[k++]=m.polyval(p,C3_coeff,o,this._n)/
C3_coeff[o+p+1];
o+=p+2;
}
}
};
C4_coeff=[
+97,15015,
+1088,156,45045,
-224,-4784,1573,45045,
-10656,14144,-4576,-858,45045,
+64,624,-4576,6864,-3003,15015,
+100,208,572,3432,-12012,30030,45045,
+1,9009,
-2944,468,135135,
+5792,1040,-1287,135135,
+5952,-11648,9152,-2574,135135,
-64,-624,4576,-6864,3003,135135,
+8,10725,
+1856,-936,225225,
-8448,4992,-1144,225225,
-1440,4160,-4576,1716,225225,
-136,63063,
+1024,-208,105105,
+3584,-3328,1144,315315,
-128,135135,
-2560,832,405405,
+128,99099,
];
g.Geodesic.prototype.C4coeff=function(){
var o=0,k=0,
l,j,p;
for(l=0;l<g.nC4_;++l){
for(j=g.nC4_-1;j>=l;--j){
p=g.nC4_-j-1;
this._C4x[k++]=m.polyval(p,C4_coeff,o,this._n)
/C4_coeff[o+p+1];
o+=p+2;
}
}
};
g.Geodesic.prototype.A3f=function(eps){
return m.polyval(nA3x_-1,this._A3x,0,eps);
};
g.Geodesic.prototype.C3f=function(eps,c){
var mult=1,
o=0,
l,p;
for(l=1;l<g.nC3_;++l){
p=g.nC3_-l-1;
mult*=eps;
c[l]=mult*m.polyval(p,this._C3x,o,eps);
o+=p+1;
}
};
g.Geodesic.prototype.C4f=function(eps,c){
var mult=1,
o=0,
l,p;
for(l=0;l<g.nC4_;++l){
p=g.nC4_-l-1;
c[l]=mult*m.polyval(p,this._C4x,o,eps);
o+=p+1;
mult*=eps;
}
};
g.Geodesic.prototype.Lengths=function(eps,sig12,
ssig1,csig1,dn1,ssig2,csig2,dn2,
cbet1,cbet2,outmask,
C1a,C2a){
outmask&=g.OUT_MASK;
var vals={},
m0x=0,J12=0,A1=0,A2=0,
B1,B2,l,csig12,t;
if(outmask&(g.DISTANCE|g.REDUCEDLENGTH|g.GEODESICSCALE)){
A1=g.A1m1f(eps);
g.C1f(eps,C1a);
if(outmask&(g.REDUCEDLENGTH|g.GEODESICSCALE)){
A2=g.A2m1f(eps);
g.C2f(eps,C2a);
m0x=A1-A2;
A2=1+A2;
}
A1=1+A1;
}
if(outmask&g.DISTANCE){
B1=g.SinCosSeries(true,ssig2,csig2,C1a)-
g.SinCosSeries(true,ssig1,csig1,C1a);
vals.s12b=A1*(sig12+B1);
if(outmask&(g.REDUCEDLENGTH|g.GEODESICSCALE)){
B2=g.SinCosSeries(true,ssig2,csig2,C2a)-
g.SinCosSeries(true,ssig1,csig1,C2a);
J12=m0x*sig12+(A1*B1-A2*B2);
}
}else if(outmask&(g.REDUCEDLENGTH|g.GEODESICSCALE)){
for(l=1;l<=g.nC2_;++l)
C2a[l]=A1*C1a[l]-A2*C2a[l];
J12=m0x*sig12+(g.SinCosSeries(true,ssig2,csig2,C2a)-
g.SinCosSeries(true,ssig1,csig1,C2a));
}
if(outmask&g.REDUCEDLENGTH){
vals.m0=m0x;
vals.m12b=dn2*(csig1*ssig2)-dn1*(ssig1*csig2)-
csig1*csig2*J12;
}
if(outmask&g.GEODESICSCALE){
csig12=csig1*csig2+ssig1*ssig2;
t=this._ep2*(cbet1-cbet2)*(cbet1+cbet2)/(dn1+dn2);
vals.M12=csig12+(t*ssig2-csig2*J12)*ssig1/dn1;
vals.M21=csig12-(t*ssig1-csig1*J12)*ssig2/dn2;
}
return vals;
};
g.Geodesic.prototype.InverseStart=function(sbet1,cbet1,dn1,
sbet2,cbet2,dn2,lam12,
C1a,C2a){
var vals={},
sbet12=sbet2*cbet1-cbet2*sbet1,
cbet12=cbet2*cbet1+sbet2*sbet1,
sbet12a,shortline,omg12,sbetm2,somg12,comg12,t,ssig12,csig12,
x,y,lamscale,betscale,k2,eps,cbet12a,bet12a,m12b,m0,nvals,
k,omg12a;
vals.sig12=-1;
sbet12a=sbet2*cbet1;
sbet12a+=cbet2*sbet1;
shortline=cbet12>=0&&sbet12<0.5&&cbet2*lam12<0.5;
omg12=lam12;
if(shortline){
sbetm2=m.sq(sbet1+sbet2);
sbetm2/=sbetm2+m.sq(cbet1+cbet2);
vals.dnm=Math.sqrt(1+this._ep2*sbetm2);
omg12/=this._f1*vals.dnm;
}
somg12=Math.sin(omg12);comg12=Math.cos(omg12);
vals.salp1=cbet2*somg12;
vals.calp1=comg12>=0?
sbet12+cbet2*sbet1*m.sq(somg12)/(1+comg12):
sbet12a-cbet2*sbet1*m.sq(somg12)/(1-comg12);
ssig12=m.hypot(vals.salp1,vals.calp1);
csig12=sbet1*sbet2+cbet1*cbet2*comg12;
if(shortline&&ssig12<this._etol2){
vals.salp2=cbet1*somg12;
vals.calp2=sbet12-cbet1*sbet2*
(comg12>=0?m.sq(somg12)/(1+comg12):1-comg12);
t=m.hypot(vals.salp2,vals.calp2);vals.salp2/=t;vals.calp2/=t;
vals.sig12=Math.atan2(ssig12,csig12);
}else if(Math.abs(this._n)>0.1||
csig12>=0||
ssig12>=6*Math.abs(this._n)*Math.PI*m.sq(cbet1)){
}else{
if(this.f>=0){
k2=m.sq(sbet1)*this._ep2;
eps=k2/(2*(1+Math.sqrt(1+k2))+k2);
lamscale=this.f*cbet1*this.A3f(eps)*Math.PI;
betscale=lamscale*cbet1;
x=(lam12-Math.PI)/lamscale;
y=sbet12a/betscale;
}else{
cbet12a=cbet2*cbet1-sbet2*sbet1;
bet12a=Math.atan2(sbet12a,cbet12a);
nvals=this.Lengths(this._n,Math.PI+bet12a,
sbet1,-cbet1,dn1,sbet2,cbet2,dn2,
cbet1,cbet2,g.REDUCEDLENGTH,C1a,C2a);
m12b=nvals.m12b;m0=nvals.m0;
x=-1+m12b/(cbet1*cbet2*m0*Math.PI);
betscale=x<-0.01?sbet12a/x:
-this.f*m.sq(cbet1)*Math.PI;
lamscale=betscale/cbet1;
y=(lam12-Math.PI)/lamscale;
}
if(y>-tol1_&&x>-1-xthresh_){
if(this.f>=0){
vals.salp1=Math.min(1,-x);
vals.calp1=-Math.sqrt(1-m.sq(vals.salp1));
}else{
vals.calp1=Math.max(x>-tol1_?0:-1,x);
vals.salp1=Math.sqrt(1-m.sq(vals.calp1));
}
}else{
k=Astroid(x,y);
omg12a=lamscale*(this.f>=0?-x*k/(1+k):-y*(1+k)/k);
somg12=Math.sin(omg12a);comg12=-Math.cos(omg12a);
vals.salp1=cbet2*somg12;
vals.calp1=sbet12a-
cbet2*sbet1*m.sq(somg12)/(1-comg12);
}
}
if(!(vals.salp1<=0)){
t=m.hypot(vals.salp1,vals.calp1);vals.salp1/=t;vals.calp1/=t;
}else{
vals.salp1=1;vals.calp1=0;
}
return vals;
};
g.Geodesic.prototype.Lambda12=function(sbet1,cbet1,dn1,sbet2,cbet2,dn2,
salp1,calp1,diffp,
C1a,C2a,C3a){
var vals={},
t,salp0,calp0,
somg1,comg1,somg2,comg2,omg12,B312,h0,k2,nvals;
if(sbet1===0&&calp1===0)
calp1=-g.tiny_;
salp0=salp1*cbet1;
calp0=m.hypot(calp1,salp1*sbet1);
vals.ssig1=sbet1;somg1=salp0*sbet1;
vals.csig1=comg1=calp1*cbet1;
t=m.hypot(vals.ssig1,vals.csig1);vals.ssig1/=t;vals.csig1/=t;
vals.salp2=cbet2!==cbet1?salp0/cbet2:salp1;
vals.calp2=cbet2!==cbet1||Math.abs(sbet2)!==-sbet1?
Math.sqrt(m.sq(calp1*cbet1)+(cbet1<-sbet1?
(cbet2-cbet1)*(cbet1+cbet2):
(sbet1-sbet2)*(sbet1+sbet2)))/
cbet2:Math.abs(calp1);
vals.ssig2=sbet2;somg2=salp0*sbet2;
vals.csig2=comg2=vals.calp2*cbet2;
t=m.hypot(vals.ssig2,vals.csig2);vals.ssig2/=t;vals.csig2/=t;
vals.sig12=Math.atan2(Math.max(0,vals.csig1*vals.ssig2-
vals.ssig1*vals.csig2),
vals.csig1*vals.csig2+vals.ssig1*vals.ssig2);
omg12=Math.atan2(Math.max(0,comg1*somg2-somg1*comg2),
comg1*comg2+somg1*somg2);
k2=m.sq(calp0)*this._ep2;
vals.eps=k2/(2*(1+Math.sqrt(1+k2))+k2);
this.C3f(vals.eps,C3a);
B312=(g.SinCosSeries(true,vals.ssig2,vals.csig2,C3a)-
g.SinCosSeries(true,vals.ssig1,vals.csig1,C3a));
h0=-this.f*this.A3f(vals.eps);
vals.domg12=salp0*h0*(vals.sig12+B312);
vals.lam12=omg12+vals.domg12;
if(diffp){
if(vals.calp2===0)
vals.dlam12=-2*this._f1*dn1/sbet1;
else{
nvals=this.Lengths(vals.eps,vals.sig12,
vals.ssig1,vals.csig1,dn1,
vals.ssig2,vals.csig2,dn2,
cbet1,cbet2,g.REDUCEDLENGTH,C1a,C2a);
vals.dlam12=nvals.m12b;
vals.dlam12*=this._f1/(vals.calp2*cbet2);
}
}
return vals;
};
g.Geodesic.prototype.Inverse=function(lat1,lon1,lat2,lon2,outmask){
var vals={},
lon12,lonsign,t,swapp,latsign,
sbet1,cbet1,sbet2,cbet2,s12x,m12x,
dn1,dn2,lam12,slam12,clam12,
sig12,calp1,salp1,calp2,salp2,C1a,C2a,C3a,meridian,nvals,
ssig1,csig1,ssig2,csig2,eps,omg12,dnm,
numit,salp1a,calp1a,salp1b,calp1b,
tripn,tripb,v,dv,dalp1,sdalp1,cdalp1,nsalp1,
lengthmask,salp0,calp0,alp12,k2,A4,C4a,B41,B42,
somg12,domg12,dbet1,dbet2,salp12,calp12;
if(!outmask)outmask=g.STANDARD;
if(outmask==g.LONG_UNROLL)outmask|=g.STANDARD;
outmask&=g.OUT_MASK;
vals.lat1=lat1=m.LatFix(lat1);vals.lat2=lat2=m.LatFix(lat2);
lon12=m.AngDiff(lon1,lon2);
if(outmask&g.LONG_UNROLL){
vals.lon1=lon1;vals.lon2=lon1+lon12;
}else{
vals.lon1=m.AngNormalize(lon1);vals.lon2=m.AngNormalize(lon2);
}
lon12=m.AngRound(lon12);
lonsign=lon12>=0?1:-1;
lon12*=lonsign;
lat1=m.AngRound(lat1);
lat2=m.AngRound(lat2);
swapp=Math.abs(lat1)>=Math.abs(lat2)?1:-1;
if(swapp<0){
lonsign*=-1;
t=lat1;
lat1=lat2;
lat2=t;
}
latsign=lat1<0?1:-1;
lat1*=latsign;
lat2*=latsign;
t=m.sincosd(lat1);sbet1=this._f1*t.s;cbet1=t.c;
t=m.hypot(sbet1,cbet1);sbet1/=t;cbet1/=t;
cbet1=Math.max(g.tiny_,cbet1);
t=m.sincosd(lat2);sbet2=this._f1*t.s;cbet2=t.c;
t=m.hypot(sbet2,cbet2);sbet2/=t;cbet2/=t;
cbet2=Math.max(g.tiny_,cbet2);
if(cbet1<-sbet1){
if(cbet2===cbet1)
sbet2=sbet2<0?sbet1:-sbet1;
}else{
if(Math.abs(sbet2)===-sbet1)
cbet2=cbet1;
}
dn1=Math.sqrt(1+this._ep2*m.sq(sbet1));
dn2=Math.sqrt(1+this._ep2*m.sq(sbet2));
lam12=lon12*m.degree;
t=m.sincosd(lon12);slam12=t.s;clam12=t.c;
C1a=new Array(g.nC1_+1);
C2a=new Array(g.nC2_+1)
C3a=new Array(g.nC3_);
meridian=lat1===-90||slam12===0;
if(meridian){
calp1=clam12;salp1=slam12;
calp2=1;salp2=0;
ssig1=sbet1;csig1=calp1*cbet1;
ssig2=sbet2;csig2=calp2*cbet2;
sig12=Math.atan2(Math.max(0,csig1*ssig2-ssig1*csig2),
csig1*csig2+ssig1*ssig2);
nvals=this.Lengths(this._n,sig12,
ssig1,csig1,dn1,ssig2,csig2,dn2,cbet1,cbet2,
outmask|g.DISTANCE|g.REDUCEDLENGTH,
C1a,C2a);
s12x=nvals.s12b;
m12x=nvals.m12b;
if((outmask&g.GEODESICSCALE)!==0){
vals.M12=nvals.M12;
vals.M21=nvals.M21;
}
if(sig12<1||m12x>=0){
if(sig12<3*g.tiny_)
sig12=m12x=s12x=0;
m12x*=this._b;
s12x*=this._b;
vals.a12=sig12/m.degree;
}else
meridian=false;
}
if(!meridian&&
sbet1===0&&
(this.f<=0||lam12<=Math.PI-this.f*Math.PI)){
calp1=calp2=0;salp1=salp2=1;
s12x=this.a*lam12;
sig12=omg12=lam12/this._f1;
m12x=this._b*Math.sin(sig12);
if(outmask&g.GEODESICSCALE)
vals.M12=vals.M21=Math.cos(sig12);
vals.a12=lon12/this._f1;
}else if(!meridian){
nvals=this.InverseStart(sbet1,cbet1,dn1,sbet2,cbet2,dn2,lam12,
C1a,C2a);
sig12=nvals.sig12;
salp1=nvals.salp1;
calp1=nvals.calp1;
if(sig12>=0){
salp2=nvals.salp2;
calp2=nvals.calp2;
dnm=nvals.dnm;
s12x=sig12*this._b*dnm;
m12x=m.sq(dnm)*this._b*Math.sin(sig12/dnm);
if(outmask&g.GEODESICSCALE)
vals.M12=vals.M21=Math.cos(sig12/dnm);
vals.a12=sig12/m.degree;
omg12=lam12/(this._f1*dnm);
}else{
numit=0;
salp1a=g.tiny_;calp1a=1;salp1b=g.tiny_;calp1b=-1;
for(tripn=false,tripb=false;numit<maxit2_;++numit){
nvals=this.Lambda12(sbet1,cbet1,dn1,sbet2,cbet2,dn2,
salp1,calp1,numit<maxit1_,
C1a,C2a,C3a);
v=nvals.lam12-lam12;
salp2=nvals.salp2;
calp2=nvals.calp2;
sig12=nvals.sig12;
ssig1=nvals.ssig1;
csig1=nvals.csig1;
ssig2=nvals.ssig2;
csig2=nvals.csig2;
eps=nvals.eps;
omg12=nvals.domg12;
dv=nvals.dlam12;
if(tripb||!(Math.abs(v)>=(tripn?8:2)*tol0_))
break;
if(v>0&&(numit<maxit1_||calp1/salp1>calp1b/salp1b)){
salp1b=salp1;calp1b=calp1;
}else if(v<0&&
(numit<maxit1_||calp1/salp1<calp1a/salp1a)){
salp1a=salp1;calp1a=calp1;
}
if(numit<maxit1_&&dv>0){
dalp1=-v/dv;
sdalp1=Math.sin(dalp1);cdalp1=Math.cos(dalp1);
nsalp1=salp1*cdalp1+calp1*sdalp1;
if(nsalp1>0&&Math.abs(dalp1)<Math.PI){
calp1=calp1*cdalp1-salp1*sdalp1;
salp1=nsalp1;
t=m.hypot(salp1,calp1);salp1/=t;calp1/=t;
tripn=Math.abs(v)<=16*tol0_;
continue;
}
}
salp1=(salp1a+salp1b)/2;
calp1=(calp1a+calp1b)/2;
t=m.hypot(salp1,calp1);salp1/=t;calp1/=t;
tripn=false;
tripb=(Math.abs(salp1a-salp1)+(calp1a-calp1)<tolb_||
Math.abs(salp1-salp1b)+(calp1-calp1b)<tolb_);
}
lengthmask=outmask|
(outmask&(g.REDUCEDLENGTH|g.GEODESICSCALE)?
g.DISTANCE:g.NONE);
nvals=this.Lengths(eps,sig12,
ssig1,csig1,dn1,ssig2,csig2,dn2,cbet1,cbet2,
lengthmask,C1a,C2a);
s12x=nvals.s12b;
m12x=nvals.m12b;
if((outmask&g.GEODESICSCALE)!==0){
vals.M12=nvals.M12;
vals.M21=nvals.M21;
}
m12x*=this._b;
s12x*=this._b;
vals.a12=sig12/m.degree;
omg12=lam12-omg12;
}
}
if(outmask&g.DISTANCE)
vals.s12=0+s12x;
if(outmask&g.REDUCEDLENGTH)
vals.m12=0+m12x;
if(outmask&g.AREA){
salp0=salp1*cbet1;
calp0=m.hypot(calp1,salp1*sbet1);
if(calp0!==0&&salp0!==0){
ssig1=sbet1;csig1=calp1*cbet1;
ssig2=sbet2;csig2=calp2*cbet2;
k2=m.sq(calp0)*this._ep2;
eps=k2/(2*(1+Math.sqrt(1+k2))+k2);
A4=m.sq(this.a)*calp0*salp0*this._e2;
t=m.hypot(ssig1,csig1);ssig1/=t;csig1/=t;
t=m.hypot(ssig2,csig2);ssig2/=t;csig2/=t;
C4a=new Array(g.nC4_);
this.C4f(eps,C4a);
B41=g.SinCosSeries(false,ssig1,csig1,C4a);
B42=g.SinCosSeries(false,ssig2,csig2,C4a);
vals.S12=A4*(B42-B41);
}else
vals.S12=0;
if(!meridian&&
omg12<0.75*Math.PI&&
sbet2-sbet1<1.75){
somg12=Math.sin(omg12);domg12=1+Math.cos(omg12);
dbet1=1+cbet1;dbet2=1+cbet2;
alp12=2*Math.atan2(somg12*(sbet1*dbet2+sbet2*dbet1),
domg12*(sbet1*sbet2+dbet1*dbet2));
}else{
salp12=salp2*calp1-calp2*salp1;
calp12=calp2*calp1+salp2*salp1;
if(salp12===0&&calp12<0){
salp12=g.tiny_*calp1;
calp12=-1;
}
alp12=Math.atan2(salp12,calp12);
}
vals.S12+=this._c2*alp12;
vals.S12*=swapp*lonsign*latsign;
vals.S12+=0;
}
if(swapp<0){
t=salp1;
salp1=salp2;
salp2=t;
t=calp1;
calp1=calp2;
calp2=t;
if(outmask&g.GEODESICSCALE){
t=vals.M12;
vals.M12=vals.M21;
vals.M21=t;
}
}
salp1*=swapp*lonsign;calp1*=swapp*latsign;
salp2*=swapp*lonsign;calp2*=swapp*latsign;
if(outmask&g.AZIMUTH){
vals.azi1=m.atan2d(salp1,calp1);
vals.azi2=m.atan2d(salp2,calp2);
}
return vals;
};
g.Geodesic.prototype.GenDirect=function(lat1,lon1,azi1,
arcmode,s12_a12,outmask){
var line;
if(!outmask)
outmask=g.STANDARD;
else if(outmask==g.LONG_UNROLL)
outmask|=g.STANDARD;
line=new l.GeodesicLine(this,lat1,lon1,azi1,
outmask|(arcmode?g.NONE:g.DISTANCE_IN));
return line.GenPosition(arcmode,s12_a12,outmask);
};
g.Geodesic.prototype.Direct=function(lat1,lon1,azi1,s12,outmask){
return this.GenDirect(lat1,lon1,azi1,false,s12,outmask);
};
g.Geodesic.prototype.ArcDirect=function(lat1,lon1,azi1,a12,outmask){
return this.GenDirect(lat1,lon1,azi1,true,a12,outmask);
};
g.Geodesic.prototype.Line=function(lat1,lon1,azi1,caps){
return new l.GeodesicLine(this,lat1,lon1,azi1,caps);
};
g.Geodesic.prototype.Polygon=function(polyline){
return new p.PolygonArea(this,polyline);
};
g.WGS84=new g.Geodesic(c.WGS84.a,c.WGS84.f);
})(GeographicLib.Geodesic,GeographicLib.GeodesicLine,
GeographicLib.PolygonArea,GeographicLib.Math,GeographicLib.Constants);
// GeographicLib/GeodesicLine.js
(function(
g,
l,m){
"use strict";
l.GeodesicLine=function(geod,lat1,lon1,azi1,caps){
var t,cbet1,sbet1,eps,s,c;
if(!caps)caps=g.STANDARD|g.DISTANCE_IN;
this.a=geod.a;
this.f=geod.f;
this._b=geod._b;
this._c2=geod._c2;
this._f1=geod._f1;
this._caps=(!caps?g.ALL:(caps|g.LATITUDE|g.AZIMUTH))|
g.LONG_UNROLL;
this.lat1=m.LatFix(lat1);
this.lon1=lon1;
this.azi1=m.AngNormalize(azi1);
t=m.sincosd(m.AngRound(this.azi1));this._salp1=t.s;this._calp1=t.c;
t=m.sincosd(m.AngRound(this.lat1));sbet1=this._f1*t.s;cbet1=t.c;
t=m.hypot(sbet1,cbet1);sbet1/=t;cbet1/=t;
cbet1=Math.max(g.tiny_,cbet1);
this._dn1=Math.sqrt(1+geod._ep2*m.sq(sbet1));
this._salp0=this._salp1*cbet1;
this._calp0=m.hypot(this._calp1,this._salp1*sbet1);
this._ssig1=sbet1;this._somg1=this._salp0*sbet1;
this._csig1=this._comg1=
sbet1!==0||this._calp1!==0?cbet1*this._calp1:1;
t=m.hypot(this._ssig1,this._csig1);
this._ssig1/=t;this._csig1/=t;
this._k2=m.sq(this._calp0)*geod._ep2;
eps=this._k2/(2*(1+Math.sqrt(1+this._k2))+this._k2);
if(this._caps&g.CAP_C1){
this._A1m1=g.A1m1f(eps);
this._C1a=new Array(g.nC1_+1);
g.C1f(eps,this._C1a);
this._B11=g.SinCosSeries(true,this._ssig1,this._csig1,this._C1a);
s=Math.sin(this._B11);c=Math.cos(this._B11);
this._stau1=this._ssig1*c+this._csig1*s;
this._ctau1=this._csig1*c-this._ssig1*s;
}
if(this._caps&g.CAP_C1p){
this._C1pa=new Array(g.nC1p_+1);
g.C1pf(eps,this._C1pa);
}
if(this._caps&g.CAP_C2){
this._A2m1=g.A2m1f(eps);
this._C2a=new Array(g.nC2_+1);
g.C2f(eps,this._C2a);
this._B21=g.SinCosSeries(true,this._ssig1,this._csig1,this._C2a);
}
if(this._caps&g.CAP_C3){
this._C3a=new Array(g.nC3_);
geod.C3f(eps,this._C3a);
this._A3c=-this.f*this._salp0*geod.A3f(eps);
this._B31=g.SinCosSeries(true,this._ssig1,this._csig1,this._C3a);
}
if(this._caps&g.CAP_C4){
this._C4a=new Array(g.nC4_);
geod.C4f(eps,this._C4a);
this._A4=m.sq(this.a)*this._calp0*this._salp0*geod._e2;
this._B41=g.SinCosSeries(false,this._ssig1,this._csig1,this._C4a);
}
};
l.GeodesicLine.prototype.GenPosition=function(arcmode,s12_a12,
outmask){
var vals={},
sig12,ssig12,csig12,B12,AB1,ssig2,csig2,tau12,s,c,serr,
omg12,lam12,lon12,E,sbet2,cbet2,somg2,comg2,salp2,calp2,dn2,
B22,AB2,J12,t,B42,salp12,calp12;
if(!outmask)
outmask=g.STANDARD;
else if(outmask==g.LONG_UNROLL)
outmask|=g.STANDARD;
outmask&=this._caps&g.OUT_MASK;
vals.lat1=this.lat1;vals.azi1=this.azi1;
vals.lon1=outmask&g.LONG_UNROLL?
this.lon1:m.AngNormalize(this.lon1);
if(arcmode)
vals.a12=s12_a12;
else
vals.s12=s12_a12;
if(!(arcmode||(this._caps&g.DISTANCE_IN&g.OUT_MASK))){
vals.a12=Number.NaN;
return vals;
}
B12=0;AB1=0;
if(arcmode){
sig12=s12_a12*m.degree;
t=m.sincosd(s12_a12);ssig12=t.s;csig12=t.c;
}else{
tau12=s12_a12/(this._b*(1+this._A1m1));
s=Math.sin(tau12);
c=Math.cos(tau12);
B12=-g.SinCosSeries(true,
this._stau1*c+this._ctau1*s,
this._ctau1*c-this._stau1*s,
this._C1pa);
sig12=tau12-(B12-this._B11);
ssig12=Math.sin(sig12);csig12=Math.cos(sig12);
if(Math.abs(this.f)>0.01){
ssig2=this._ssig1*csig12+this._csig1*ssig12;
csig2=this._csig1*csig12-this._ssig1*ssig12;
B12=g.SinCosSeries(true,ssig2,csig2,this._C1a);
serr=(1+this._A1m1)*(sig12+(B12-this._B11))-
s12_a12/this._b;
sig12=sig12-serr/Math.sqrt(1+this._k2*m.sq(ssig2));
ssig12=Math.sin(sig12);csig12=Math.cos(sig12);
}
}
ssig2=this._ssig1*csig12+this._csig1*ssig12;
csig2=this._csig1*csig12-this._ssig1*ssig12;
dn2=Math.sqrt(1+this._k2*m.sq(ssig2));
if(outmask&(g.DISTANCE|g.REDUCEDLENGTH|g.GEODESICSCALE)){
if(arcmode||Math.abs(this.f)>0.01)
B12=g.SinCosSeries(true,ssig2,csig2,this._C1a);
AB1=(1+this._A1m1)*(B12-this._B11);
}
sbet2=this._calp0*ssig2;
cbet2=m.hypot(this._salp0,this._calp0*csig2);
if(cbet2===0)
cbet2=csig2=g.tiny_;
salp2=this._salp0;calp2=this._calp0*csig2;
if(arcmode&&(outmask&g.DISTANCE))
vals.s12=this._b*((1+this._A1m1)*sig12+AB1);
if(outmask&g.LONGITUDE){
somg2=this._salp0*ssig2;comg2=csig2;
E=this._salp0<0?-1:1;
omg12=outmask&g.LONG_UNROLL?
E*(sig12-
(Math.atan2(ssig2,csig2)-
Math.atan2(this._ssig1,this._csig1))+
(Math.atan2(E*somg2,comg2)-
Math.atan2(E*this._somg1,this._comg1))):
Math.atan2(somg2*this._comg1-comg2*this._somg1,
comg2*this._comg1+somg2*this._somg1);
lam12=omg12+this._A3c*
(sig12+(g.SinCosSeries(true,ssig2,csig2,this._C3a)-
this._B31));
lon12=lam12/m.degree;
vals.lon2=outmask&g.LONG_UNROLL?this.lon1+lon12:
m.AngNormalize(m.AngNormalize(this.lon1)+m.AngNormalize(lon12));
}
if(outmask&g.LATITUDE)
vals.lat2=m.atan2d(sbet2,this._f1*cbet2);
if(outmask&g.AZIMUTH)
vals.azi2=m.atan2d(salp2,calp2);
if(outmask&(g.REDUCEDLENGTH|g.GEODESICSCALE)){
B22=g.SinCosSeries(true,ssig2,csig2,this._C2a);
AB2=(1+this._A2m1)*(B22-this._B21);
J12=(this._A1m1-this._A2m1)*sig12+(AB1-AB2);
if(outmask&g.REDUCEDLENGTH)
vals.m12=this._b*((dn2*(this._csig1*ssig2)-
this._dn1*(this._ssig1*csig2))-
this._csig1*csig2*J12);
if(outmask&g.GEODESICSCALE){
t=this._k2*(ssig2-this._ssig1)*(ssig2+this._ssig1)/
(this._dn1+dn2);
vals.M12=csig12+(t*ssig2-csig2*J12)*this._ssig1/this._dn1;
vals.M21=csig12-(t*this._ssig1-this._csig1*J12)*ssig2/dn2;
}
}
if(outmask&g.AREA){
B42=g.SinCosSeries(false,ssig2,csig2,this._C4a);
if(this._calp0===0||this._salp0===0){
salp12=salp2*this._calp1-calp2*this._salp1;
calp12=calp2*this._calp1+salp2*this._salp1;
if(salp12===0&&calp12<0){
salp12=g.tiny_*this._calp1;
calp12=-1;
}
}else{
salp12=this._calp0*this._salp0*
(csig12<=0?this._csig1*(1-csig12)+ssig12*this._ssig1:
ssig12*(this._csig1*ssig12/(1+csig12)+this._ssig1));
calp12=m.sq(this._salp0)+m.sq(this._calp0)*this._csig1*csig2;
}
vals.S12=this._c2*Math.atan2(salp12,calp12)+
this._A4*(B42-this._B41);
}
if(!arcmode)
vals.a12=sig12/m.degree;
return vals;
};
l.GeodesicLine.prototype.Position=function(s12,outmask){
return this.GenPosition(false,s12,outmask);
};
l.GeodesicLine.prototype.ArcPosition=function(a12,outmask){
return this.GenPosition(true,a12,outmask);
};
})(GeographicLib.Geodesic,GeographicLib.GeodesicLine,GeographicLib.Math);
// GeographicLib/PolygonArea.js
(function(
p,g,m,a){
"use strict";
var transit,transitdirect;
transit=function(lon1,lon2){
var lon12,cross;
lon1=m.AngNormalize(lon1);
lon2=m.AngNormalize(lon2);
lon12=m.AngDiff(lon1,lon2);
cross=lon1<0&&lon2>=0&&lon12>0?1:
(lon2<0&&lon1>=0&&lon12<0?-1:0);
return cross;
};
transitdirect=function(lon1,lon2){
lon1=lon1%720.0;lon2=lon2%720.0;
return(((lon2>=0&&lon2<360)||lon2<-360?0:1)-
((lon1>=0&&lon1<360)||lon1<-360?0:1));
};
p.PolygonArea=function(geod,polyline){
this._geod=geod;
this.a=this._geod.a;
this.f=this._geod.f;
this._area0=4*Math.PI*geod._c2;
this.polyline=!polyline?false:polyline;
this._mask=g.LATITUDE|g.LONGITUDE|g.DISTANCE|
(this.polyline?g.NONE:g.AREA|g.LONG_UNROLL);
if(!this.polyline)
this._areasum=new a.Accumulator(0);
this._perimetersum=new a.Accumulator(0);
this.Clear();
};
p.PolygonArea.prototype.Clear=function(){
this.num=0;
this._crossings=0;
if(!this.polyline)
this._areasum.Set(0);
this._perimetersum.Set(0);
this._lat0=this._lon0=this.lat=this.lon=Number.NaN;
};
p.PolygonArea.prototype.AddPoint=function(lat,lon){
var t;
if(this.num===0){
this._lat0=this.lat=lat;
this._lon0=this.lon=lon;
}else{
t=this._geod.Inverse(this.lat,this.lon,lat,lon,this._mask);
this._perimetersum.Add(t.s12);
if(!this.polyline){
this._areasum.Add(t.S12);
this._crossings+=transit(this.lon,lon);
}
this.lat=lat;
this.lon=lon;
}
++this.num;
};
p.PolygonArea.prototype.AddEdge=function(azi,s){
var t;
if(this.num){
t=this._geod.Direct(this.lat,this.lon,azi,s,this._mask);
this._perimetersum.Add(s);
if(!this.polyline){
this._areasum.Add(t.S12);
this._crossings+=transitdirect(this.lon,t.lon2);
}
this.lat=t.lat2;
this.lon=t.lon2;
}
++this.num;
};
p.PolygonArea.prototype.Compute=function(reverse,sign){
var vals={number:this.num},t,tempsum,crossings;
if(this.num<2){
vals.perimeter=0;
if(!this.polyline)
vals.area=0;
return vals;
}
if(this.polyline){
vals.perimeter=this._perimetersum.Sum();
return vals;
}
t=this._geod.Inverse(this.lat,this.lon,this._lat0,this._lon0,
this._mask);
vals.perimeter=this._perimetersum.Sum(t.s12);
tempsum=new a.Accumulator(this._areasum);
tempsum.Add(t.S12);
crossings=this._crossings+transit(this.lon,this._lon0);
if(crossings&1)
tempsum.Add((tempsum.Sum()<0?1:-1)*this._area0/2);
if(!reverse)
tempsum.Negate();
if(sign){
if(tempsum.Sum()>this._area0/2)
tempsum.Add(-this._area0);
else if(tempsum.Sum()<=-this._area0/2)
tempsum.Add(+this._area0);
}else{
if(tempsum.Sum()>=this._area0)
tempsum.Add(-this._area0);
else if(tempsum<0)
tempsum.Add(-this._area0);
}
vals.area=tempsum.Sum();
return vals;
};
p.PolygonArea.prototype.TestPoint=function(lat,lon,reverse,sign){
var vals={number:this.num+1},t,tempsum,crossings,i;
if(this.num===0){
vals.perimeter=0;
if(!this.polyline)
vals.area=0;
return vals;
}
vals.perimeter=this._perimetersum.Sum();
tempsum=this.polyline?0:this._areasum.Sum();
crossings=this._crossings;
for(i=0;i<(this.polyline?1:2);++i){
t=this._geod.Inverse(
i===0?this.lat:lat,i===0?this.lon:lon,
i!==0?this._lat0:lat,i!==0?this._lon0:lon,
this._mask);
vals.perimeter+=t.s12;
if(!this.polyline){
tempsum+=t.S12;
crossings+=transit(i===0?this.lon:lon,
i!==0?this._lon0:lon);
}
}
if(this.polyline)
return vals;
if(crossings&1)
tempsum+=(tempsum<0?1:-1)*this._area0/2;
if(!reverse)
tempsum*=-1;
if(sign){
if(tempsum>this._area0/2)
tempsum-=this._area0;
else if(tempsum<=-this._area0/2)
tempsum+=this._area0;
}else{
if(tempsum>=this._area0)
tempsum-=this._area0;
else if(tempsum<0)
tempsum+=this._area0;
}
vals.area=tempsum;
return vals;
};
p.PolygonArea.prototype.TestEdge=function(azi,s,reverse,sign){
var vals={number:this.num?this.num+1:0},t,tempsump,crossings;
if(this.num===0)
return vals;
vals.perimeter=this._perimetersum.Sum()+s;
if(this.polyline)
return vals;
tempsum=this._areasum.Sum();
crossings=this._crossings;
t=this._geod.Direct(this.lat,this.lon,azi,s,this._mask);
tempsum+=t.S12;
crossings+=transitdirect(this.lon,t.lon2);
t=this._geod(t.lat2,t.lon2,this._lat0,this._lon0,this._mask);
perimeter+=t.s12;
tempsum+=t.S12;
crossings+=transit(t.lon2,this._lon0);
if(crossings&1)
tempsum+=(tempsum<0?1:-1)*this._area0/2;
if(!reverse)
tempsum*=-1;
if(sign){
if(tempsum>this._area0/2)
tempsum-=this._area0;
else if(tempsum<=-this._area0/2)
tempsum+=this._area0;
}else{
if(tempsum>=this._area0)
tempsum-=this._area0;
else if(tempsum<0)
tempsum+=this._area0;
}
vals.area=tempsum;
return vals;
};
})(GeographicLib.PolygonArea,GeographicLib.Geodesic,
GeographicLib.Math,GeographicLib.Accumulator);
// GeographicLib/DMS.js
GeographicLib.DMS={};
(function(
d){
"use strict";
var lookup,zerofill,InternalDecode,NumMatch,
hemispheres_="SNWE",
signs_="-+",
digits_="0123456789",
dmsindicators_="D'\":",
dmsindicatorsu_="\u00b0'\"",
components_=["degrees","minutes","seconds"];
lookup=function(s,c){
return s.indexOf(c.toUpperCase());
};
zerofill=function(s,n){
return String("0000").substr(0,Math.max(0,Math.min(4,n-s.length)))+
s;
};
d.NONE=0;
d.LATITUDE=1;
d.LONGITUDE=2;
d.AZIMUTH=3;
d.DEGREE=0;
d.MINUTE=1;
d.SECOND=2;
d.Decode=function(dms){
var dmsa=dms,end,
v=0,i=0,mi,pi,vals,
ind1=d.NONE,ind2,p,pa,pb;
dmsa=dmsa.replace(/\u00b0/g,'d')
.replace(/\u00ba/g,'d')
.replace(/\u2070/g,'d')
.replace(/\u02da/g,'d')
.replace(/\u2032/g,'\'')
.replace(/\u00b4/g,'\'')
.replace(/\u2019/g,'\'')
.replace(/\u2033/g,'"')
.replace(/\u201d/g,'"')
.replace(/\u2212/g,'-')
.replace(/''/g,'"')
.trim();
end=dmsa.length;
for(p=0;p<end;p=pb,++i){
pa=p;
if(i===0&&lookup(hemispheres_,dmsa.charAt(pa))>=0)
++pa;
if(i>0||(pa<end&&lookup(signs_,dmsa.charAt(pa))>=0))
++pa;
mi=dmsa.substr(pa,end-pa).indexOf('-');
pi=dmsa.substr(pa,end-pa).indexOf('+');
if(mi<0)mi=end;else mi+=pa;
if(pi<0)pi=end;else pi+=pa;
pb=Math.min(mi,pi);
vals=InternalDecode(dmsa.substr(p,pb-p));
v+=vals.val;ind2=vals.ind;
if(ind1==d.NONE)
ind1=ind2;
else if(!(ind2==d.NONE||ind1==ind2))
throw new Error("Incompatible hemisphere specifies in "+
dmsa.substr(0,pb));
}
if(i===0)
throw new Error("Empty or incomplete DMS string "+dmsa);
return{val:v,ind:ind1};
};
InternalDecode=function(dmsa){
var vals={},errormsg="",
sign,beg,end,ind1,k,
ipieces,fpieces,npiece,
icurrent,fcurrent,ncurrent,p,
pointseen,
digcount,intcount,
x;
do{
sign=1;
beg=0;end=dmsa.length;
ind1=d.NONE;
k=-1;
if(end>beg&&(k=lookup(hemispheres_,dmsa.charAt(beg)))>=0){
ind1=(k&2)?d.LONGITUDE:d.LATITUDE;
sign=(k&1)?1:-1;
++beg;
}
if(end>beg&&
(k=lookup(hemispheres_,dmsa.charAt(end-1)))>=0){
if(k>=0){
if(ind1!==d.NONE){
if(dmsa.charAt(beg-1).toUpperCase()===
dmsa.charAt(end-1).toUpperCase())
errormsg="Repeated hemisphere indicators "+
dmsa.charAt(beg-1)+" in "+
dmsa.substr(beg-1,end-beg+1);
else
errormsg="Contradictory hemisphere indicators "+
dmsa.charAt(beg-1)+" and "+dmsa.charAt(end-1)+" in "+
dmsa.substr(beg-1,end-beg+1);
break;
}
ind1=(k&2)?d.LONGITUDE:d.LATITUDE;
sign=(k&1)?1:-1;
--end;
}
}
if(end>beg&&(k=lookup(signs_,dmsa.charAt(beg)))>=0){
if(k>=0){
sign*=k?1:-1;
++beg;
}
}
if(end===beg){
errormsg="Empty or incomplete DMS string "+dmsa;
break;
}
ipieces=[0,0,0];
fpieces=[0,0,0];
npiece=0;
icurrent=0;
fcurrent=0;
ncurrent=0;
p=beg;
pointseen=false;
digcount=0;
intcount=0;
while(p<end){
x=dmsa.charAt(p++);
if((k=lookup(digits_,x))>=0){
++ncurrent;
if(digcount>0){
++digcount;
}else{
icurrent=10*icurrent+k;
++intcount;
}
}else if(x==='.'){
if(pointseen){
errormsg="Multiple decimal points in "+
dmsa.substr(beg,end-beg);
break;
}
pointseen=true;
digcount=1;
}else if((k=lookup(dmsindicators_,x))>=0){
if(k>=3){
if(p===end){
errormsg="Illegal for colon to appear at the end of "+
dmsa.substr(beg,end-beg);
break;
}
k=npiece;
}
if(k===npiece-1){
errormsg="Repeated "+components_[k]+
" component in "+dmsa.substr(beg,end-beg);
break;
}else if(k<npiece){
errormsg=components_[k]+" component follows "+
components_[npiece-1]+" component in "+
dmsa.substr(beg,end-beg);
break;
}
if(ncurrent===0){
errormsg="Missing numbers in "+components_[k]+
" component of "+dmsa.substr(beg,end-beg);
break;
}
if(digcount>0){
fcurrent=parseFloat(dmsa.substr(p-intcount-digcount-1,
intcount+digcount));
icurrent=0;
}
ipieces[k]=icurrent;
fpieces[k]=icurrent+fcurrent;
if(p<end){
npiece=k+1;
icurrent=fcurrent=0;
ncurrent=digcount=intcount=0;
}
}else if(lookup(signs_,x)>=0){
errormsg="Internal sign in DMS string "+
dmsa.substr(beg,end-beg);
break;
}else{
errormsg="Illegal character "+x+" in DMS string "+
dmsa.substr(beg,end-beg);
break;
}
}
if(errormsg.length)
break;
if(lookup(dmsindicators_,dmsa.charAt(p-1))<0){
if(npiece>=3){
errormsg="Extra text following seconds in DMS string "+
dmsa.substr(beg,end-beg);
break;
}
if(ncurrent===0){
errormsg="Missing numbers in trailing component of "+
dmsa.substr(beg,end-beg);
break;
}
if(digcount>0){
fcurrent=parseFloat(dmsa.substr(p-intcount-digcount,
intcount+digcount));
icurrent=0;
}
ipieces[npiece]=icurrent;
fpieces[npiece]=icurrent+fcurrent;
}
if(pointseen&&digcount===0){
errormsg="Decimal point in non-terminal component of "+
dmsa.substr(beg,end-beg);
break;
}
if(ipieces[1]>=60||fpieces[1]>60){
errormsg="Minutes "+fpieces[1]+" not in range [0,60)";
break;
}
if(ipieces[2]>=60||fpieces[2]>60){
errormsg="Seconds "+fpieces[2]+" not in range [0,60)";
break;
}
vals.ind=ind1;
vals.val=sign*
(fpieces[2]?(60*(60*fpieces[0]+fpieces[1])+fpieces[2])/3600:
(fpieces[1]?(60*fpieces[0]+fpieces[1])/60:fpieces[0]));
return vals;
}while(false);
vals.val=NumMatch(dmsa);
if(vals.val===0)
throw new Error(errormsg);
else
vals.ind=d.NONE;
return vals;
};
NumMatch=function(s){
var t,sign,p0,p1;
if(s.length<3)
return 0;
t=s.toUpperCase().replace(/0+$/,"");
sign=t.charAt(0)==='-'?-1:1;
p0=t.charAt(0)==='-'||t.charAt(0)==='+'?1:0;
p1=t.length-1;
if(p1+1<p0+3)
return 0;
t=t.substr(p0,p1+1-p0);
if(t==="NAN"||t==="1.#QNAN"||t==="1.#SNAN"||t==="1.#IND"||
t==="1.#R")
return Number.NaN;
else if(t==="INF"||t==="1.#INF")
return sign*Number.POSITIVE_INFINITY;
return 0;
};
d.DecodeLatLon=function(stra,strb,longfirst){
var vals={},
valsa=d.Decode(stra),
valsb=d.Decode(strb),
a=valsa.val,ia=valsa.ind,
b=valsb.val,ib=valsb.ind,
lat,lon;
if(!longfirst)longfirst=false;
if(ia===d.NONE&&ib===d.NONE){
ia=longfirst?d.LONGITUDE:d.LATITUDE;
ib=longfirst?d.LATITUDE:d.LONGITUDE;
}else if(ia===d.NONE)
ia=d.LATITUDE+d.LONGITUDE-ib;
else if(ib===d.NONE)
ib=d.LATITUDE+d.LONGITUDE-ia;
if(ia===ib)
throw new Error("Both "+stra+" and "+strb+" interpreted as "+
(ia===d.LATITUDE?"latitudes":"longitudes"));
lat=ia===d.LATITUDE?a:b;
lon=ia===d.LATITUDE?b:a;
if(Math.abs(lat)>90)
throw new Error("Latitude "+lat+" not in [-90,90]");
vals.lat=lat;
vals.lon=lon;
return vals;
};
d.DecodeAngle=function(angstr){
var vals=d.Decode(angstr),
ang=vals.val,ind=vals.ind;
if(ind!==d.NONE)
throw new Error("Arc angle "+angstr+" includes a hemisphere N/E/W/S");
return ang;
};
d.DecodeAzimuth=function(azistr){
var vals=d.Decode(azistr),
azi=vals.val,ind=vals.ind;
if(ind===d.LATITUDE)
throw new Error("Azimuth "+azistr+" has a latitude hemisphere N/S");
return azi;
};
d.Encode=function(angle,trailing,prec,ind){
var scale=1,i,sign,
idegree,fdegree,f,pieces,ip,fp,s;
if(!ind)ind=d.NONE;
if(!isFinite(angle))
return angle<0?String("-inf"):
(angle>0?String("inf"):String("nan"));
prec=Math.min(15-2*trailing,prec);
for(i=0;i<trailing;++i)
scale*=60;
for(i=0;i<prec;++i)
scale*=10;
if(ind===d.AZIMUTH)
angle-=Math.floor(angle/360)*360;
sign=angle<0?-1:1;
angle*=sign;
idegree=Math.floor(angle);
fdegree=(angle-idegree)*scale+0.5;
f=Math.floor(fdegree);
fdegree=(f==fdegree&&(f&1))?f-1:f;
fdegree/=scale;
fdegree=Math.floor((angle-idegree)*scale+0.5)/scale;
if(fdegree>=1){
idegree+=1;
fdegree-=1;
}
pieces=[fdegree,0,0];
for(i=1;i<=trailing;++i){
ip=Math.floor(pieces[i-1]);
fp=pieces[i-1]-ip;
pieces[i]=fp*60;
pieces[i-1]=ip;
}
pieces[0]+=idegree;
s="";
if(ind===d.NONE&&sign<0)
s+='-';
switch(trailing){
case d.DEGREE:
s+=zerofill(pieces[0].toFixed(prec),
ind===d.NONE?0:
1+Math.min(ind,2)+prec+(prec?1:0))+
dmsindicatorsu_.charAt(0);
break;
default:
s+=zerofill(pieces[0].toFixed(0),
ind===d.NONE?0:1+Math.min(ind,2))+
dmsindicatorsu_.charAt(0);
switch(trailing){
case d.MINUTE:
s+=zerofill(pieces[1].toFixed(prec),2+prec+(prec?1:0))+
dmsindicatorsu_.charAt(1);
break;
case d.SECOND:
s+=zerofill(pieces[1].toFixed(0),2)+dmsindicatorsu_.charAt(1);
s+=zerofill(pieces[2].toFixed(prec),2+prec+(prec?1:0))+
dmsindicatorsu_.charAt(2);
break;
default:
break;
}
}
if(ind!==d.NONE&&ind!==d.AZIMUTH)
s+=hemispheres_.charAt((ind===d.LATITUDE?0:2)+
(sign<0?0:1));
return s;
};
})(GeographicLib.DMS);
if(typeof module!=='undefined')module.exports=GeographicLib;
