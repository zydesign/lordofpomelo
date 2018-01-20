var utils = require('../../../util/utils');
var teamManager = require('../../../services/teamManager');

module.exports = function(){
  return new TeamRemote();
};

var TeamRemote = function(){
};

// can a player create a game copy 
//允许玩家创建游戏副本
TeamRemote.prototype.canCreateGameCopy = function(args, cb){
  var playerId = args.playerId;
  var teamId = args.teamId;

  var result = false;
  var teamObj = teamManager.getTeamById(teamId);
  if(teamObj) {
    result = teamObj.isCaptainById(playerId);
  }

  utils.invokeCallback(cb, null, result);
};

// create a new team 创建一个新队伍（ 由area服务器handler/teamHandler.createTeam执行rpc到该函数）
TeamRemote.prototype.createTeam = function(args, cb) {
  utils.myPrint('TeamRemote ~ createTeam is running ...typeof args = ', typeof args);
  utils.myPrint('args = ', args);
  utils.myPrint('playerInfo = ', JSON.stringify(args.playerInfo));
  
  var ret = teamManager.createTeam(args);

  utils.invokeCallback(cb, null, ret);
};

// disband a team
//通过id解散队伍（area/handler/teamHandler.disbandTeam调用该函数）
TeamRemote.prototype.disbandTeamById = function(args, cb){
  var playerId = args.playerId;
  var teamId = args.teamId;
  //执行解散队伍逻辑，返回ret：{result: consts.TEAM.OK}
  var ret = teamManager.disbandTeamById(playerId, teamId);
  utils.myPrint('TeamRemote ~ DisbandTeamById is running ~ ret = ', ret);
  utils.invokeCallback(cb, null, ret);  
};

// leave a team
// 玩家离开队伍，通过id
//（客户端掉线时area/remote/playerRemote.playerLeave执行rpc到该函数，让玩家脱离队伍）
//（玩家主动离队area/handler/teamHandler.leaveTeam执行rpc到该函数，让玩家脱离队伍）
TeamRemote.prototype.leaveTeamById = function(args, cb){
  var playerId = args.playerId;
  var teamId = args.teamId;
  teamManager.leaveTeamById(playerId, teamId, cb);
};

// drag the team members to the game copy
TeamRemote.prototype.dragMember2gameCopy = function(args, cb) {
  utils.myPrint('1 ~ DragMember2gameCopy ~ args = ', JSON.stringify(args));
  teamManager.dragMember2gameCopy(args, cb);
};

// applicant apply to join the team
TeamRemote.prototype.applyJoinTeam = function(args, cb){
  utils.myPrint('ApplyJoinTeam is running ... args = ', JSON.stringify(args));
  var ret = teamManager.applyJoinTeam(args);
  utils.invokeCallback(cb, null, ret);
};

// accept applicant join team
TeamRemote.prototype.acceptApplicantJoinTeam = function(args, cb){
  utils.myPrint('AcceptApplicantJoinTeam is running ... args = ', JSON.stringify(args));
  var ret = teamManager.acceptApplicantJoinTeam(args);
  utils.myPrint('AcceptApplicantJoinTeam ~ ret = ', ret);
  utils.invokeCallback(cb, null, ret);
};

// captain invite a player to join the team
TeamRemote.prototype.inviteJoinTeam = function(args, cb){
  utils.myPrint('InviteJoinTeam is running ... args = ', JSON.stringify(args));
  var ret = teamManager.inviteJoinTeam(args);
  utils.invokeCallback(cb, null, ret);
};

// accept captain's invitation join team
TeamRemote.prototype.acceptInviteJoinTeam = function(args, cb){
  utils.myPrint('AcceptInviteJoinTeam is running ... args = ', JSON.stringify(args));
  var ret = teamManager.acceptInviteJoinTeam(args);
  utils.myPrint('AcceptInviteJoinTeam ~ ret = ', ret);
  utils.invokeCallback(cb, null, ret);
};

// update team member's new info
//更新队员信息。args为player生成的玩家数据。（area/handler/playerHandler.enterScene执行rpc调用该函数）
TeamRemote.prototype.updateMemberInfo = function(args, cb){
  utils.myPrint('UpdateMemberInfo is running ... args = ', JSON.stringify(args));
  var ret = teamManager.updateMemberInfo(args);    //执行服务teamManager
  utils.myPrint('UpdateMemberInfo ~ ret = ', JSON.stringify(ret));
  utils.invokeCallback(cb, null, ret);
};

// chat in team
TeamRemote.prototype.chatInTeam = function(args, cb){
  utils.myPrint('ChatInTeam is running ... args = ', JSON.stringify(args));
  var ret = teamManager.chatInTeam(args);
  utils.invokeCallback(cb, null, ret);
};

// leave a team
TeamRemote.prototype.kickOut = function(args, cb){
  teamManager.kickOut(args, cb);
};
