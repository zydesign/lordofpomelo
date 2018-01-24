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
		var aniOrientation = require('consts').aniOrientation;    //角色朝向
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

    //加载json资源。
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
	    
      var version = dataApi.getVersion();    //获取数据版本号，开始没有就是{}
	    //通过版本号，请求资源加载，然后设置数据，设置版本号
      pomelo.request('area.resourceHandler.loadResource', {version: version},  function(result) {
        dataApi.setData(result.data);           //设置数据
        dataApi.setVersion(result.version);     //设置版本号
        this.jsonLoad = false;                  //加载json资源完毕.改为不加载json资源
        if (callback) {
          callback();
        }
      });
    };
	  
    //加载场景资源
    pro.loadAreaResource = function() {
      var self = this;
      pomelo.request('area.resourceHandler.loadAreaResource',  {},function(data) {
        self.setTotalCount(1 + 1 + (data.players.length  + data.mobs.length) * 16 + data.npcs.length + data.items.length + data.equipments.length);

        self.loadJsonResource(function(){
          self.setLoadedCount(self.loadedCount + 1);
          self.loadMap(data.mapName);
          self.loadCharacter(data.players);
          self.loadCharacter(data.mobs);
          self.loadNpc(data.npcs);
          self.loadItem(data.items);
          self.loadEquipment(data.equipments);
					initObjectPools(data.mobs, EntityType.MOB);
					initObjectPools(data.players, EntityType.PLAYER);
        });
      });
    };

    //加载图片资源
    pro.loadImg = function(src) {
      var self = this;
      var img = new Image();
      img.onload = function() {
        self.setLoadedCount(self.loadedCount + 1);
      };

      img.onerror = function() {
        self.setLoadedCount(self.loadedCount + 1);
      };

      img.src = src;
    };

    //加载地图资源  
    pro.loadMap = function(name) {
      this.loadImg(imgURL + 'map/' + name + ".jpg");
    };

    //加载角色资源
    pro.loadCharacter = function(ids) {
      var animation = ['Attack', 'Stand', 'Walk', 'Dead'];
      var self = this;
      ids.forEach(function(id) {
        animation.forEach(function(action) {
					for (var key in aniOrientation) {
						self.loadImg(imgURL + 'animation/' + id + '/' +aniOrientation[key] + action + '.png');
					}
        });
      });
    };

    //加载NPC资源
    pro.loadNpc = function(ids) {
      var self = this;
      ids.forEach(function(id) {
        self.loadImg(imgURL + 'npc/' + id + '.png');
      });
    };

    //加载道具资源
    pro.loadItem = function(ids) {
      if (ids.length > 0) {
        var self = this;
        var items = dataApi.item.all();
        ids.forEach(function(id) {
          self.loadImg(imgURL + 'item/item_' + items[id].imgId + '.png');
        });
      }
    };

    //加载装备资源
    pro.loadEquipment = function(ids) {
      if (ids.length > 0) {
        var self = this;
        var equipments = dataApi.equipment.all();
        ids.forEach(function(id) {
          self.loadImg(imgURL + 'equipment/item_' + equipments[id].imgId + '.png');
        });
      }
    };

    /**
     * Initialize objectPool
     *
		 * @param {Array} ids
		 * @api private
		 */
		var initObjectPools = function(ids, type) {
			var of = new ObjectPoolFactory();
			for (var i = 0; i < ids.length; i ++) {
				var kindId = ids[i];
        of.createPools(kindId, type);	
			}
		};

    module.exports = ResourceLoader;
  }
};
