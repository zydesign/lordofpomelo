var Area = require('./area');

//场景副本类。就是实例的一个带生命周期的场景area
var Instance = function(opts){
  this.id = opts.instanceId;
  this.area = new Area(opts);
  this.lifeTime = opts.lifeTime || 1800000;  //副本生命周期
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
    //玩家数量为0开始的时间大于生命周期就是副本超时了，死区，需要关闭
    if((Date.now() - this.area.emptyTime) > this.lifeTime){
      return false;
    }
  }
  return true;
};

