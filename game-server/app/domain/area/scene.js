var Area = require('./area');
var Map = require('../map/map');

var exp = module.exports;

var area = null;

//场景area的入口，init（opt）由app提供参数启动，并且给参数opt提供地图map属性，地图权重weightMap属性 
exp.init = function(opts){
  if(!area) {
    opts.weightMap = true;
    opts.map = new Map(opts);
    area = new Area(opts);
  }
};

exp.getArea = function(){
  return area;
};
