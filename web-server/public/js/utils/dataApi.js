__resources__["/dataApi.js"] = {
  meta: {
    mimetype: "application/javascript"
  },

  data: function(exports, require, module, __filename, __dirname) {

    //普通数据类-------------------------------------------------------------------------------------【普通数据类】
    function Data(key) {
      this.key = key;    //key为数据类型（如：item）
      this.data = null;  //对应类型的数据
    }

    //localStorage是IE的api。设置字段localStorage.setItem（key，value）
    //普通数据的set
    Data.prototype.set = function(data) {
      this.data = data;   //数据存到this.data
      var self = this;
      setTimeout(function(){
        localStorage.setItem(self.key, JSON.stringify(data));   //数据存在到localStorage
      }, 300);
    };

    //通过id查找普通数据
    Data.prototype.findById = function(id) {
      var data = this.all();
      return data[id];
    };

    //返回全部普通数据
    Data.prototype.all = function() {
      //如果this.data为null，设置为{}
      if (!this.data) {
        this.data = JSON.parse(localStorage.getItem(this.key)) || {};
      }
      return this.data;
    };

    // animation data
    //动画数据类--------------------------------------------------------------------------------------【动画数据类】
    function AnimationData() {
      this.data = {};
    }

    //动画数据的set
    AnimationData.prototype.set = function(data) {
      data || (data = {});
      this.data = data;         //数据存到this.data
      setTimeout(function() {
        for (var k in data) {
          localStorage.setItem('ani_' + k, JSON.stringify(data[k]));  //动画数据的每一个单项存到localStorage
        }
      }, 600);
    };

    //通过id获取动画数据
    AnimationData.prototype.get = function(id) {
      var ani  = this.data[id];
      //如果获取不到id动画数据，id名改为ani_id后再获取，或返回空对象{}
      if (!ani) {
        ani =  JSON.parse(localStorage.getItem('ani_' + id)) || {};
      }
      return ani;
    };

    
    //特效数据--------------------------------------------------------------------------------------【特效数据】
    function Effect(data) {
      this.key = 'effect';
    }

    //特效数据的set
    Effect.prototype.set = function(data) {
      localStorage.setItem(this.key, JSON.stringify(data));
    };

    //从本地获取全部特效数据
    Effect.prototype.all = function(id) {
      return JSON.parse(localStorage.getItem(this.key)) || {};
    };

    //获取指定id特效数据
    Effect.prototype.findById = function(id) {
      var data = this.all();
      var i, result;
      for (i in data) {
        if (data[i].id == id) {
          result = data[i];
          break;
        }
      }
      return result;
    };

    //获取数据版本,开始没有就是{}
    exports.getVersion = function() {
      return JSON.parse(localStorage.getItem('version')) || {};
    };

    //设置数据版本
    exports.setVersion = function(version) {
      localStorage.setItem('version', JSON.stringify(version));
    };

    exports.fightskill = new Data('fightskill');    //实例战斗技能数据
    exports.equipment = new Data( 'equipment');     //实例装备数据
    exports.item = new Data('item');                //实例道具数据
    exports.character = new Data('character');      //实例角色数据
    exports.npc = new Data('npc');                  //实例npc数据
    exports.animation = new AnimationData();        //实例动画数据
    exports.effect = new Effect();                  //实例特效数据

    //(resourceLoader.loadJsonResource调用该函数设置数据)
    exports.setData = function(data) {              //给所有类型的数据类添加数据
      if (data) {
        var obj;
        for (var i in data) {
          obj = exports[i];   
          if (obj && obj.set) {
            obj.set(data[i]);    //给每一类填充数据
          }
        }
      }
    };

  }
};
