__resources__["/resourceLoader.js"] = {
  meta: {
    mimetype: "application/javascript"
  },
//资源加载模块

  data: function(exports, require, module, __filename, __dirname) {
    var pomelo = window.pomelo;
    var dataApi = require('dataApi');                                     //数据api
    var imgURL = require('config').IMAGE_URL;                             //图片地址
    var EventEmitter = window.EventEmitter;                               //事件发射器
		var EntityType = require('consts').EntityType;            //实体类型对象
		var aniOrientation = require('consts').aniOrientation;    //角色初始朝向
		var ObjectPoolFactory = require('objectPoolFactory');     //对象池工厂

	  
    //资源加载器----------------------------------------------------------------------------【资源加载器】
    function ResourceLoader(opt) {
      EventEmitter.call(this);         //让ResourceLoader继承事件发射器工厂函数
      opt || (opt = {});
      this.totalCount = 0;             //加载总数
      this.loadedCount = 0;            //已加载数
      this.jsonLoad = !!opt.jsonLoad;  //是否加载json资源（也就是请求服务器获取data，设置数据）  
    }

	  //让ResourceLoader继承事件发射器原型链
    var pro = ResourceLoader.prototype = Object.create(EventEmitter.prototype);

    //设置总数-----------------------------------------------------------------------【设置总数，发射'loading'事件】
    pro.setTotalCount = function(count) {      
      this.totalCount = count;
      //发射'loading'事件
      this.emit('loading', {total: this.totalCount, loaded: this.loadedCount});   
    };

    //设置已加载数---------------------------------------------------------------------【设置已加载数】
    pro.setLoadedCount = function(count) {     
      this.loadedCount = count;
	    
      //发射'loading'事件    
      this.emit('loading', {total: this.totalCount, loaded: this.loadedCount});   
	    
      //如果登录数等于总数，发射'complete'事件    
      if (this.loadedCount === this.totalCount) {                                 
        this.emit('complete');
      }
    };

    //加载json资源----------------------------------------------------------------------------【加载json资源】
    pro.loadJsonResource = function(callback) {
	    //如果不加载json资源------------------------------------不加载json资源
      if (this.jsonLoad === false) {
        if (callback) { 
          setTimeout(function(){   //50毫秒后执行cb
            callback();
          }, 50);
        }
        return;
      }
	   //加载json资源------------------------------------------加载json资源 
	    
      var version = dataApi.getVersion();    //获取数据版本号，第一次请求没有version就是{}，第二次之后请求就有了（比如切换地图加载资源）
	    //通过版本号，请求资源加载，然后设置数据，设置版本号
	    //请求返回result：{data: data, version: version} 各类型的总数据 和 各类型的最新版本
      pomelo.request('area.resourceHandler.loadResource', {version: version},  function(result) {
        dataApi.setData(result.data);           //设置数据
        dataApi.setVersion(result.version);     //设置版本号
        this.jsonLoad = false;                  //加载json资源完毕.改为不加载json资源
        if (callback) {
          callback();
        }
      });
    };
	  
    //加载场景资源---------------------------------------------------------------------------------------【加载场景资源】
    pro.loadAreaResource = function() {
      var self = this;
	    //请求场景资源加载，返回data为{players,mobs,npcs,items,equipments,mapName}各个数据表的id组
      pomelo.request('area.resourceHandler.loadAreaResource',  {},function(data) {
	      //执行设置资源总数（1+1为两次请求服务器)
        self.setTotalCount(1 + 1 + (data.players.length  + data.mobs.length) * 16 + data.npcs.length + data.items.length + data.equipments.length);

	      //先执行加载json资源数据，有了数据再加载图片
        self.loadJsonResource(function(){
          self.setLoadedCount(self.loadedCount + 1);     //已加载数+1（loadJsonResource算一个）
          self.loadMap(data.mapName);                    //执行加载地图（地图图片，已加载数+1）
          self.loadCharacter(data.players);              //执行加载玩家（各类型角色，4个动画状态，4个方位图片，已加载数+N）
          self.loadCharacter(data.mobs);                 //执行加载怪物（同上，已加载数+N）
          self.loadNpc(data.npcs);                       //执行加载NPC（各种类型npc一张图片，已加载数+N）
          self.loadItem(data.items);                     //执行加载道具（各种类型道具一张图片，已加载数+N）
          self.loadEquipment(data.equipments);           //执行加载装备（各种类型装备一张图片，已加载数+N）
	
	  initObjectPools(data.mobs, EntityType.MOB);         //初始化怪物对象池    （怪物kindId对应animation的kindId）
	  initObjectPools(data.players, EntityType.PLAYER);   //初始化玩家角色对象池 （玩家kindId对应animation的kindId）
        });
      });
    };

    //加载图片
    pro.loadImg = function(src) {
      var self = this;
      var img = new Image();   //实例 Image对象（js的图片类）
      //设置图片加载完毕事件
      img.onload = function() {
        self.setLoadedCount(self.loadedCount + 1);  //加载了一张图片，已加载数+1
      };

      //设置图片加载错误事件
      img.onerror = function() {
        self.setLoadedCount(self.loadedCount + 1);  //加载错误，也是已加载数+1
      };

      img.src = src;      //图片地址
    };

    //加载地图资源（参数name为图片名称）-----------------------------------------------------------------【加载地图资源】
    pro.loadMap = function(name) {
      this.loadImg(imgURL + 'map/' + name + ".jpg");
    };

    //加载角色资源-------------------------------------------------------------------------------------【加载角色资源】
    pro.loadCharacter = function(ids) {
      var animation = ['Attack', 'Stand', 'Walk', 'Dead'];      //动画状态
      var self = this;
      ids.forEach(function(id) {                                            //遍历每个种类角色
        animation.forEach(function(action) {                                //遍历每个动画状态
					for (var key in aniOrientation) {   //遍历每个状态的方位
						//给每个方位加载一张图片（为何不是gif？）
						self.loadImg(imgURL + 'animation/' + id + '/' +aniOrientation[key] + action + '.png');
					}
        });
      });
    };

    //加载NPC资源-----------------------------------------------------------------------------------------【加载NPC资源】
    pro.loadNpc = function(ids) {
      var self = this;
      ids.forEach(function(id) {
        self.loadImg(imgURL + 'npc/' + id + '.png');
      });
    };

    //加载道具资源-----------------------------------------------------------------------------------------【加载道具资源】
    pro.loadItem = function(ids) {
      if (ids.length > 0) {
        var self = this;
        var items = dataApi.item.all();
        ids.forEach(function(id) {
          self.loadImg(imgURL + 'item/item_' + items[id].imgId + '.png');   //从道具数据的imgId生成图片名
        });
      }
    };

    //加载装备资源------------------------------------------------------------------------------------------【加载装备资源】
    pro.loadEquipment = function(ids) {
      if (ids.length > 0) {
        var self = this;
        var equipments = dataApi.equipment.all();
        ids.forEach(function(id) {
          self.loadImg(imgURL + 'equipment/item_' + equipments[id].imgId + '.png');   //从装备数据的imgId生成图片名
        });
      }
    };

    /**
     * Initialize objectPool
     *
     * @param {Array} ids
     * @api private
     */
     //初始化对象池------------------------------------------------------------------初始化对象池
     var initObjectPools = function(ids, type) {
	     var of = new ObjectPoolFactory();
	     //遍历每个种类id，给每个种类创建对象池
	     for (var i = 0; i < ids.length; i ++) {
		     var kindId = ids[i];
		     of.createPools(kindId, type);
		     }
	     };

    module.exports = ResourceLoader;
  }
};
