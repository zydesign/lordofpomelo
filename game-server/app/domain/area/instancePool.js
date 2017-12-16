var Instance = require('./instance');
var dataApi = require('../../util/dataApi');
var Map = require('../map/map');
var pomelo = require('pomelo');

var logger = require('pomelo-logger').getLogger(__filename);

//场景副本池
var exp = module.exports;

var instances;
var intervel;
var maps = {};

//服务器运行，立即执行该函数...........................1
exp.init = function(opts){
  instances = {};   //副本组
  intervel = opts.intervel||60000;   //时间间隔

  setInterval(check, intervel);   //定时器
};


//创建场景副本，然后启动该场景副本，并加入副本组，如果创建成功返回true-------------------------增
//玩家创建单人副本，多人副本时调用该函数
exp.create = function(params){
  var id = params.instanceId;
  var areaId = params.areaId;

  //如果场景副本组中有了该副本，返回失败
  if(instances[id]) return false;

  //get area map
  //获取该场景副本数据
  var opts = dataApi.area.findById(areaId);
  //如果地图组没有该地图，生成一个地图实例
  if(!maps[areaId]){
    maps[areaId] = new Map(opts);
  }
  //场景副本数据中加入该地图
  opts.map = maps[areaId];

  //Create instance
  //通过场景副本数据生成副本场景
  var instance = new Instance(opts);

  //加入副本组中
  instances[id] = instance;

  //启动该副本
  instance.start();
  return true;
};

//删除场景副本，先关闭该副本，然后从副本组中删除，如果删除成功，返回true--------------------删
exp.remove = function(params){
  var id = params.id;
  if(!instances[id]) return false;

  var instance = instances[id];
  instance.close();
  delete instances[id];

  return true;
};

//获取场景副本-----------------------------------------查
exp.getArea = function(instanceId){
  return instances[instanceId].area;
};


//开启服务器，就立即定时执行............................2
function check(){
  var app = pomelo.app;
  for(var id in instances){
    var instance = instances[id];

    //重启场景副本，如果该场景被关闭了（玩家退出副本），关闭该场景副本，并从副本组中删除
    if(!instance.isAlive()){
      app.rpc.manager.instanceRemote.remove(null, id, onClose);
    }
  }
}

function onClose(err, id){
  if(!err){
    instances[id].close();
    delete instances[id];
    logger.info('remove instance : %j', id);
  }else{
    logger.warn('remove instance error! id : %j, err : %j', id, err);
  }
}

