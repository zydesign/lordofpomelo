var Area = require('./area');

//场景副本类。就是实例的一个带生命周期的场景area
var Instance = function(opts){
  this.id = opts.instanceId;
  this.area = new Area(opts);
  this.lifeTime = opts.lifeTime || 1800000;  //副本没人后的，生命时间为30分钟
};

module.exports = Instance;

//副本开启
Instance.prototype.start = function(){
  this.area.start();
};

//副本关闭
Instance.prototype.close = function(){
  this.area.close();
};

//获取场景
Instance.prototype.getArea = function(){
  return this.area;
};
//判断该副本是否还开着
Instance.prototype.isAlive = function(){
  if(this.area.isEmpty()){
    //玩家数量为0开始计算的时间超过30分钟，变死区，需要关闭
    if((Date.now() - this.area.emptyTime) > this.lifeTime){
      return false;
    }
  }
  return true;
};

