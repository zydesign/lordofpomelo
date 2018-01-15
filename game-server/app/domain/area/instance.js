var Area = require('./area');

//场景副本类。就是实例的一个带生命周期的场景area（instancePool.create副本池创建新副本调用该函数）
var Instance = function(opts){
  this.id = opts.instanceId;
  this.area = new Area(opts);
  this.lifeTime = opts.lifeTime || 1800000;  //副本没人后的，生命时间为30分钟
};

module.exports = Instance;

//副本开启。执行area的开启函数。（其实new Area的时候就会执行area.start了，这函数主要是close过后再开才会调用）
Instance.prototype.start = function(){
  this.area.start();
};

//副本关闭。（执行area的关闭函数）
Instance.prototype.close = function(){
  this.area.close();
};

//获取场景对象
Instance.prototype.getArea = function(){
  return this.area;
};
//判断副本是否有活人，有活人返回true，没活人返回false
Instance.prototype.isAlive = function(){
  //如果场景的玩家为空，返回true
  if(this.area.isEmpty()){
    //玩家数量为0开始计算的时间超过30分钟，变死区，需要关闭
    if((Date.now() - this.area.emptyTime) > this.lifeTime){
      return false;
    }
  }
  return true;
};

