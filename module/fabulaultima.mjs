// Import document classes.
import { FabulaUltimaActor } from "./documents/actor.mjs";
import { FabulaUltimaItem } from "./documents/item.mjs";
// Import sheet classes.
import { FabulaUltimaActorSheet } from "./sheets/actor-sheet.mjs";
import { FabulaUltimaItemSheet } from "./sheets/item-sheet.mjs";
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { FABULAULTIMA } from "./helpers/config.mjs";
import { FabulaUltimaCombatHud, FabulaUltimaCombatTracker } from "./helpers/combat.js";
import { FabulaRoll } from "./helpers/roll.mjs";
import { FabulaUltimaGroupRoll } from "./helpers/groupRoll/groupRoll.mjs";
import { LongNamePlayerList } from "./sheets/longname-player-list.mjs";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function () {

  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  game.fabulaultima = {
    FabulaUltimaActor,
    FabulaUltimaItem,
    rollItemMacro,
    combatHud: new FabulaUltimaCombatHud()
  };

  // Add custom constants for configuration.
  CONFIG.FABULAULTIMA = FABULAULTIMA;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d@abilities.dex.value + 1d@abilities.int.value",
    decimals: 2
  };

  // Define custom Document classes
  CONFIG.Actor.documentClass = FabulaUltimaActor;
  CONFIG.Item.documentClass = FabulaUltimaItem;
  CONFIG.ui.players = LongNamePlayerList;
  CONFIG.ui.combat = FabulaUltimaCombatTracker;
  CONFIG.Dice.rolls.push(FabulaRoll);

  CONFIG.statusEffects.unshift(
    buildStatusEffect('slow', [
      { 'key': 'system.status.slow', 'mode': 5, 'value': '1' },
      { 'key': 'system.abilities.dex.value', 'mode': 2, 'value': '-2' }
    ]),
    buildStatusEffect('dazed', [
      { 'key': 'system.status.dazed', 'mode': 5, 'value': '1' },
      { 'key': 'system.abilities.int.value', 'mode': 2, 'value': '-2' }
    ]),
    buildStatusEffect('weak', [
      { 'key': 'system.status.weak', 'mode': 5, 'value': '1' },
      { 'key': 'system.abilities.vig.value', 'mode': 2, 'value': '-2' }
    ]),
    buildStatusEffect('shaken', [
      { 'key': 'system.status.shaken', 'mode': 5, 'value': '1' },
      { 'key': 'system.abilities.vol.value', 'mode': 2, 'value': '-2' }
    ]),
    buildStatusEffect('enraged', [
      { 'key': 'system.status.enraged', 'mode': 5, 'value': '1' },
      { 'key': 'system.abilities.dex.value', 'mode': 2, 'value': '-2' },
      { 'key': 'system.abilities.dex.value', 'mode': 2, 'value': '-2' }
    ]),
    buildStatusEffect('poisoned', [
      { 'key': 'system.status.poisoned', 'mode': 5, 'value': '1' },
      { 'key': 'system.abilities.vig.value', 'mode': 2, 'value': '-2' },
      { 'key': 'system.abilities.vol.value', 'mode': 2, 'value': '-2' }
    ]),
  );

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("fabulaultima", FabulaUltimaActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("fabulaultima", FabulaUltimaItemSheet, { makeDefault: true });

  game.settings.register("fabulaultima", "usePeculiarities", {
    name: "FABULAULTIMA.UsePeculiarities",
    hint: "FABULAULTIMA.UsePeculiaritiesHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register("fabulaultima", "useLimits", {
    name: "FABULAULTIMA.UseLimits",
    hint: "FABULAULTIMA.UseLimitsHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register("fabulaultima", "usePartnerLimits", {
    name: "FABULAULTIMA.UsePartnerLimits",
    hint: "FABULAULTIMA.UsePartnerLimitsHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here are a few useful examples:
Handlebars.registerHelper('concat', function () {
  var outStr = '';
  for (var arg in arguments) {
    if (typeof arguments[arg] != 'object') {
      outStr += arguments[arg];
    }
  }
  return outStr;
});

Handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});

Handlebars.registerHelper('option', function (value, label, selectedValue) {
  var selectedProp = value == selectedValue ? 'selected="selected"' : '';
  return new Handlebars.SafeString('<option value="' + value + '" ' + selectedProp + '>' + label + "</option>");
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));

  // if (game.combat)
  // game.fabulaultima.combatHud.addToScreen();
});

Hooks.once("socketlib.ready", () => {
  console.log("Fabula Ultima | Ready");

  FabulaUltimaGroupRoll.ready();
  FabulaUltimaCombatHud.ready();
});

Hooks.on("createCombat", async function () {
  // game.fabulaultima.combatHud.addToScreen();
});

Hooks.on("deleteCombat", async function () {
  // game.fabulaultima.combatHud.deleteFromScreen();
});

Hooks.on("createCombatant", async function () {
  // game.fabulaultima.combatHud.update();
});

Hooks.on("deleteCombatant", async function () {
  // game.fabulaultima.combatHud.update();
});

Hooks.on("updateActor", async function (actor, changes, options, userId) {
  if (userId != game.userId)
    return;
  if (changes.system?.health) {
    const effectIconPath = 'icons/svg/hazard.svg';
    const effectLabel = 'Crisis';
    const effectOrigin = 'crisis';

    const existingEffect = actor.effects.find(i => i.data.origin === effectOrigin);
    if (existingEffect && !actor.isCrisis()) {
      await existingEffect.delete();
    } else if (!existingEffect && actor.isCrisis()) {
      await actor.createEmbeddedDocuments("ActiveEffect", [{
        label: effectLabel,
        icon: effectIconPath,
        origin: effectOrigin,
        tint: '#ff0000',
        flags: {
          core: {
            statusId: effectOrigin,
          }
        }
      }]);
    }
  }

  // if (game.combat)
  // game.fabulaultima.combatHud.update();
});

Hooks.on('getSceneControlButtons', async function (buttons) {
  FabulaUltimaGroupRoll.getSceneControlButtons(buttons);
});

Hooks.on('renderSidebarTab', (app, html, data) => {
  html.find('.chat-control-icon').click(async (event) => {
    const actor = canvas.tokens.controlled[0]?.actor || game.user.character;
    if (!actor) {
      ui.notifications.warn('You need to select a token to roll dice with');
      return;
    }
    Dialog.prompt({
      title: game.i18n.localize('FABULAULTIMA.DiceRoller'),
      content: await renderTemplate('systems/fabulaultima/templates/chat/dice-roller.html', {
        abilities: CONFIG.FABULAULTIMA.abilities,
      }),
      callback: async (html) => {
        let first = html.find('#first-ability').val();
        let second = html.find('#second-ability').val();
        let bonus = html.find('#bonus').val();
        const roll = await new Roll(
          actor.getBaseRollFormula(first, second, bonus),
          actor.getRollData()
        ).roll({ async: true });
        const chatData = {
          user: game.user._id,
          type: CONST.CHAT_MESSAGE_TYPES.ROLL,
          // content: html,
          rollMode: game.settings.get("core", "rollMode"),
          roll: roll,
          speaker: {
            alias: actor.name,
            actor: actor.id,
          }
        };
        return ChatMessage.create(chatData);
      }
    });
  });
});

Hooks.on('renderChatMessage', (message, html, messageData) => {
  new ContextMenu(html, '.dice', [
    {
      name: 'FABULAULTIMA.Reroll.First',
      icon: '<i class="fa-solid fa-dice-one"></i>',
      callback: () => { FabulaRoll.rerollChatMessage(message, html, 0) },
    },
    {
      name: 'FABULAULTIMA.Reroll.Second',
      icon: '<i class="fa-solid fa-dice-two"></i>',
      callback: () => { FabulaRoll.rerollChatMessage(message, html, 1) },
    },
    {
      name: 'FABULAULTIMA.Reroll.Both',
      icon: '<i class="fa-solid fa-dice"></i>',
      callback: () => { FabulaRoll.rerollChatMessage(message, html) },
    },
  ], {
    eventName: 'reroll_menu',
  });
  html.find('.reroll').click(async (event) => {
    event.preventDefault();
    event.stopPropagation();
    $(event.currentTarget).parents('.dice')[0].dispatchEvent(new Event('reroll_menu', { bubbles: true }));
  });
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  if (data.type !== "Item") return;
  if (!("data" in data)) return ui.notifications.warn("You can only create macro buttons for owned Items");
  const item = data.data;

  // Create the macro command
  const command = `game.fabulaultima.rollItemMacro("${item.name}");`;
  let macro = game.macros.entities.find(m => (m.name === item.name) && (m.command === command));
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "fabulaultima.itemMacro": true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @return {Promise}
 */
function rollItemMacro(itemName) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  const item = actor ? actor.items.find(i => i.name === itemName) : null;
  if (!item) return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);

  // Trigger the item roll
  return item.roll();
}

function buildStatusEffect(name, changes) {
  return {
    'id': `fabulaultima.${name}`,
    'flags': {
      'core': { 'statusId': `fabulaultima.${name}` }
    },
    'label': `FABULAULTIMA.${name[0].toUpperCase() + name.slice(1)}`,
    'icon': `systems/fabulaultima/icons/${name}.svg`,
    'changes': changes
  };
}