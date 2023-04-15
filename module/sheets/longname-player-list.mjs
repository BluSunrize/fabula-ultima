/**
 * Extend the basic PlayerList to allow for full character names to display
 * @extends {PlayerList}
 */
export class LongNamePlayerList extends PlayerList {

  /** @override */
  getData(options = {}) {
    const ret = super.getData(options);
    ret.users.forEach(u => {
      let actor = game.actors.get(u.character);
      u.charname = actor?.system.nickname || actor?.name || '';
    });
    return ret;
  }

}