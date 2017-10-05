__resources__["/teamHandler.js"] = {meta: {mimetype: "application/javascript"}, data: function(exports, require, module, __filename, __dirname) {
  var pomelo = window.pomelo;
  var btns = require('consts').BtnAction4Player;

  /**
   * Execute player action
   * 执行玩家组队动作：创建队伍、离开队伍、解散队伍
   * 用notify只向服务器广播，无需返回响应；服务器也是通过push的形式广播给各个玩家
   */
  function exec(type, params) {
    switch (type) {
      case btns.CREATE_TEAM: {
        createTeam();
      }
        break;

      case btns.LEAVE_TEAM: {
        leaveTeam(params);
      }
        break;

      case btns.DISBAND_TEAM: {
        disbandTeam(params);
      }
        break;
    }
  }

  /**
   * Create team action. 创建队伍
   */
  function createTeam() {
    pomelo.notify("area.teamHandler.createTeam");
  }

  /**
   * Leave team action. 离开队伍
   */
  function leaveTeam(params) {
    pomelo.notify("area.teamHandler.leaveTeam", params);
  }

  /**
   * Disband team action. 解散队伍
   */
  function disbandTeam(params) {
    pomelo.notify("area.teamHandler.disbandTeam", params);
  }

  exports.exec = exec;
}};
