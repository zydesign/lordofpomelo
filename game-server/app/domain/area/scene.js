var Area = require('./area');
var Map = require('../map/map');

var exp = module.exports;

var area = null;

//入口在app上下文，opt为(dataApi.area.findById(server.area))，area配置文件制定id的场景数据
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
