/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class FabulaUltimaItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["fabulaultima", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "attributes" }]
    });
  }

  /** @override */
  get template() {
    const path = "systems/fabulaultima/templates/item";
    // Return a single sheet for all item types.
    // return `${path}/item-sheet.html`;

    // Alternatively, you could use the following return statement to do a
    // unique item sheet by type, like `weapon-sheet.html`.
    return `${path}/item-${this.item.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve base data structure.
    let context = super.getData();

    // Retrieve the roll data for TinyMCE editors.
    context.rollData = {};
    let actor = this.object?.parent ?? null;
    if (actor) {
      context.rollData = actor.getRollData();
    }

    // Add the actor's data to context.data for easier access, as well as flags.
    context.data = context.item.system;
    context.flags = context.item.flags;

    if (context.item.type === "feature") {
      context = this.getFeatureData(context);
    } else if (context.item.type === "skilloption") {
      context = this.getSkilloptionData(context);
    } else if (context.item.type === "weapon") {
      context = this.getWeaponData(context);
    } else if (context.item.type === "spell") {
      context = this.getSpellData(context);
    } else if (context.item.type === "consumable") {
      context.data.recoverResources = CONFIG.FABULAULTIMA.costResources;
      context.data.damageTypes = CONFIG.FABULAULTIMA.damageTypes;
    }

    return context;
  }

  getFeatureData(context) {
    context.data.classes = game.items.filter(item => item.type === "class");
    context.data.costResources = CONFIG.FABULAULTIMA.costResources;
    context.data.timings = CONFIG.FABULAULTIMA.timings;
    context.data.actionTypes = CONFIG.FABULAULTIMA.actionTypes;

    return context;
  }

  getSkilloptionData(context) {
    context.data.costResources = CONFIG.FABULAULTIMA.costResources;

    return context;
  }

  getWeaponData(context) {
    context.data.abilities = CONFIG.FABULAULTIMA.abilities;
    context.data.weaponCategories = CONFIG.FABULAULTIMA.weaponCategories;
    context.data.weaponTypes = CONFIG.FABULAULTIMA.weaponTypes;
    context.data.damageTypes = CONFIG.FABULAULTIMA.damageTypes;

    return context;
  }

  getSpellData(context) {
    context.data.abilities = CONFIG.FABULAULTIMA.abilities;
    context.data.damageTypes = CONFIG.FABULAULTIMA.damageTypes;

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    const $context = this.getData();
    this._activateFeatureListeners(html, $context);
  }

  _activateFeatureListeners(html, context) {
    if (context.item.type === "feature") {
      html.find('#class-select').on('change', function () {
        context.data.class = $('#class-select').val();
      });
    } else if (context.item.type === "weapon") {
      /*html.find('#first-ability').on('change', function () {
        context.item.data.firstAbility = $('#first-ability').val();
      });
      html.find('#second-ability').on('change', function () {
        context.item.data.secondAbility = $('#second-ability').val();
      });
      html.find('#type-select').on('change', function () {
        context.item.data.type = $('#type-select').val();
      });*/
    }

  }
}