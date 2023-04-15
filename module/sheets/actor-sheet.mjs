import {onManageActiveEffect, prepareActiveEffectCategories} from "../helpers/effects.mjs";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class FabulaUltimaActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["fabulaultima", "sheet", "actor"],
      template: "systems/fabulaultima/templates/actor/actor-sheet.html",
      width: 600,
      height: 600,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "features" }],
      dragDrop: [{ dragSelector: '.items-list .item.can-drag', dropSelector: '.sheet-body' }],
    });
  }

  /** @override */
  get template() {
    return `systems/fabulaultima/templates/actor/actor-${this.actor.data.type}-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = context.actor.system;

    // Add the actor's data to context.system for easier access, as well as flags.
    context.system = actorData;
    context.flags = actorData.flags;

    // Prepare character data and items.
    if (context.actor.type == 'character') {
      this._prepareItems(context);
      await this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if (context.actor.type == 'npc' || context.actor.type == 'villain') {
      this._prepareItems(context);
      await this._updateAbilitiesStatusAffinities(context);
      await this._updateCharacterAttributes(context);
      await this._updateEquipmentBasedStats(context);
    }

    // Prepare Group items
    if (context.actor.type == 'group') {
      const consumables = [];
      const otherItems = [];
      for (let i of context.items) {
        if (i.type === 'consumable') {
          consumables.push(i);
        }
        else {
          otherItems.push(i);
        }
      }
      context.consumables = consumables;
      context.other = otherItems;
    }

    // Send setting flags to sheet
    context.useLimits = game.settings.get('fabulaultima', 'useLimits');
    context.usePeculiarities = game.settings.get('fabulaultima', 'usePeculiarities');

    context.system.crisisHealth = Math.floor(context.system.health.max / 2);

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(this.actor.effects);

    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  async _prepareCharacterData(context) {
    await this._updateAbilitiesStatusAffinities(context);
    this._updateCharacterLevel(context);
    this._updateCharacterPoints(context);
    this._updateCharacterAttributes(context);
    await this._updateEquipmentBasedStats(context);
  }

  async _updateAbilitiesStatusAffinities(context) {
    // Handle ability scores.
    context.system.orderedAbilities = {};

    for (const k in CONFIG.FABULAULTIMA.abilities) {
      if (Number(context.system.abilities[k].value) > Number(context.system.abilities[k].max)) {
        context.system.abilities[k].value = context.system.abilities[k].max;
      }

      context.system.abilities[k].label = game.i18n.localize(CONFIG.FABULAULTIMA.abilities[k]) ?? k;
      context.system.abilities[k].abbrLabel = game.i18n.localize(CONFIG.FABULAULTIMA.abilityAbbreviations[k]) ?? k;

      context.system.orderedAbilities[k] = context.system.abilities[k];
    }

    const statuses1 = {};
    const statuses2 = {};
    for (let [k, v] of Object.entries(CONFIG.FABULAULTIMA.statuses)) {
      if (v.affects.length > 1) {
        statuses2[k] = v;
        statuses2[k].label = game.i18n.localize(v.label);
        statuses2[k].value = context.system.status[k];
        continue;
      }

      statuses1[k] = v;
      statuses1[k].label = game.i18n.localize(v.label);
      statuses1[k].value = context.system.status[k];
    }

    context.system.statuses1 = statuses1;
    context.system.statuses2 = statuses2;

    const affinities = {};
    for (let [k, v] of Object.entries(CONFIG.FABULAULTIMA.damageTypes)) {
      if (k == 'none')
        continue;
      affinities[k] = {
        'label': game.i18n.localize(v),
        'value': context.system.affinities[k],
        'icon': CONFIG.FABULAULTIMA.damageIcons[k],
      }
    }
    context.system.orderedAffinities = affinities;
  }

  async _updateEquipmentBasedStats(context) {
    context.system.initiativeBonus = 0;
    context.system.defense = parseInt(context.system.abilities.dex.value);
    context.system.magicDefense = parseInt(context.system.abilities.int.value);

    // bonuses on enemies
    if (context.system.defenseBonus) {
      context.system.defense += parseInt(context.system.defenseBonus);
    }
    if (context.system.magicDefenseBonus) {
      context.system.magicDefense += parseInt(context.system.magicDefenseBonus);
    }

    if (context.system.equipped.armor !== "") {
      const armor = this.actor.items.get(context.system.equipped.armor);
      if (armor) {
        context.system.initiativeBonus = parseInt(armor.data.data.initiativeBonus);
        
        if (armor.data.data.defenseFormula.includes("@")) {
          const roll = await new Roll(armor.data.data.defenseFormula, this.actor.getRollData()).roll();
          console.log(roll);
          context.system.defense = parseInt(roll.total);
        } else {
          context.system.defense = parseInt(armor.data.data.defenseFormula);
        }

        if (armor.data.data.magicDefenseFormula.includes("@")) {
          const roll = await new Roll(armor.data.data.magicDefenseFormula, this.actor.getRollData()).roll();
          context.system.magicDefense = parseInt(roll.total);
        } else {
          context.system.magicDefense = parseInt(armor.data.data.magicDefenseFormula);
        }
      }
    }

    let mainHand;
    if (context.system.equipped.mainHand !== "") {
      mainHand = this.actor.items.get(context.system.equipped.mainHand);
      if (mainHand) {
        if (mainHand.data.data.quality) {
          context.system.initiativeBonus += parseInt(mainHand.data.data.quality.initiativeBonus);
          context.system.defense += parseInt(mainHand.data.data.quality.defenseBonus);
          context.system.magicDefense += parseInt(mainHand.data.data.quality.magicDefenseBonus);
        }

        context.system.defense += parseInt(mainHand.data.data.defenseBonus);
        context.system.magicDefense += parseInt(mainHand.data.data.magicDefenseBonus);
      }
    }

    if (context.system.equipped.offHand !== "") {
      const offHand = this.actor.items.get(context.system.equipped.offHand);
      if (offHand && mainHand && mainHand.id !== offHand.id) {
        if (offHand.data.data.quality) {
          context.system.initiativeBonus += parseInt(offHand.data.data.quality.initiativeBonus);
          context.system.defense += parseInt(offHand.data.data.quality.defenseBonus);
          context.system.magicDefense += parseInt(offHand.data.data.quality.magicDefenseBonus);
        }

        context.system.defense += parseInt(offHand.data.data.defenseBonus);
        context.system.magicDefense += parseInt(offHand.data.data.magicDefenseBonus);
      }
    }

    // handle all equipped accessories
    for (let item of this.actor.items)
      if (item.type === 'accessory' && item.data.data.isEquipped && item.data.data.quality) {
        context.system.initiativeBonus += parseInt(item.data.data.quality.initiativeBonus);
        context.system.defense += parseInt(item.data.data.quality.defenseBonus);
        context.system.magicDefense += parseInt(item.data.data.quality.magicDefenseBonus);
      }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const bonds = [];
    const weapons = [];
    const shields = [];
    const armor = [];
    const accessories = [];
    const classes = [];
    const other = [];
    const spells = [];
    const arcana = [];
    const features = [];
    const limits = [];

    // Iterate through items, allocating to containers
    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;
      // Append to gear.
      if (i.type === 'weapon') {
        i.formula = this.actor.getItemFormula(i);
 
        i.data.category = game.i18n.localize(CONFIG.FABULAULTIMA.weaponCategories[i.data.category]);
        i.data.type = game.i18n.localize(CONFIG.FABULAULTIMA.weaponTypes[i.data.type]);
        i.data.damage.type = game.i18n.localize(CONFIG.FABULAULTIMA.damageTypes[i.data.damage.type]);

        if (i.data.twoHanded) {
          if (context.system.equipped.mainHand === i._id) {
            i.status = game.i18n.localize("FABULAULTIMA.EquipTwoHanded");
            context.system.equipped.offHand = context.system.equipped.mainHand;
          } else {
            i.status = "";
          }
        } else {
          if (context.system.equipped.mainHand === i._id) {
            i.status = game.i18n.localize("FABULAULTIMA.MainHand");
          } else if (context.system.equipped.offHand === i._id) {
            i.status = game.i18n.localize("FABULAULTIMA.OffHand");
          } else {
            i.status = "";
          }
        }

        weapons.push(i);
      }
      else if (i.type === "shield") {
        if (context.system.equipped.mainHand === i._id) {
          i.status = game.i18n.localize("FABULAULTIMA.MainHand");
        } else if (context.system.equipped.offHand === i._id) {
          i.status = game.i18n.localize("FABULAULTIMA.OffHand");
        } else {
          i.status = "";
        }

        shields.push(i);
      }
      else if (i.type === "armor") {
        i.data.defenseFormula = this.actor.getArmorFormula(i, false);
        i.data.magicDefenseFormula = this.actor.getArmorFormula(i, true);

        if (context.system.equipped.armor === i._id) {
          i.status = game.i18n.localize("FABULAULTIMA.Equipped");
        } else {
          i.status = "";
        }

        armor.push(i);
      }
      else if (i.type === "accessory") {
        if (context.system.equipped.accessory === i._id || context.system.equipped.accessory2 === i._id) {
          i.status = game.i18n.localize("FABULAULTIMA.Equipped");
        } else {
          i.status = "";
        }

        accessories.push(i);
      }
      // Append to features.
      else if (i.type === 'class') {
        i.skills = [];
        i.spells = [];
        classes.push(i);
      }
      else if (i.type === 'bond') {
        bonds.push(i);
      }
      else if (i.type === 'limit') {
        limits.push(i);
      }
      else if (i.type === 'spell') {
        spells.push(i);
      }
      else if (i.type === 'arcanum') {
        arcana.push(i);
      }
      else if (i.type === 'feature') {
        features.push(i);
      }
      else {
        other.push(i);
      }
    }

    for (let i of context.items) {
      i.img = i.img || DEFAULT_TOKEN;
      if (i.type === 'feature') { 
        i.data.cost.resource = game.i18n.localize(CONFIG.FABULAULTIMA.costResources[i.data.cost.resource]);

        const cls = i.data.class;
        const c = classes.find(cl => cl.data.abbr === cls);
        if (c) {
          c.skills.push(i);
        }
      }
      // Append to spells.
      else if (i.type === 'spell') {
        i.data.cost.resource = game.i18n.localize(CONFIG.FABULAULTIMA.costResources[i.data.cost.resource]);

        const cls = i.data.class;
        const c = classes.find(cl => cl.data.abbr === cls);
        if (c) {
          c.spells.push(i);
        }
      }
    }

    // Assign and return
    context.bonds = bonds;
    
    context.weapons = weapons;
    context.armor = armor;
    context.accessories = accessories;
    context.shields = shields;
    context.spells = spells;
    context.arcana = arcana;
    context.features = features;
    context.other = other;
    context.limits = limits;

    context.classes = classes;
  }

  _updateCharacterLevel(context) {
    let level = 0;

    for (let c of context.classes) {
      level += c.data.level;
    }

    context.system.attributes.level.value = level;
  }

  _updateCharacterPoints(context) {
    let startingHealth = context.system.abilities.vig.max * 5;
    startingHealth += context.system.attributes.level.value;

    let startingMind = context.system.abilities.vol.max * 5;
    startingMind += context.system.attributes.level.value;

    let startingInventory = 6;

    for (let c of context.classes) {
      startingHealth += Number(c.data.healthBonus);
      startingMind += Number(c.data.mindBonus);
      startingInventory += Number(c.data.inventoryBonus);

      for (let f of c.skills) {
        startingHealth += Number(f.data.passive.hpBonus) * f.data.level;
        startingMind += Number(f.data.passive.mpBonus) * f.data.level;
        startingInventory += Number(f.data.passive.ipBonus);
      }
    }

    context.system.health.max = startingHealth;
    context.system.mind.max = startingMind;
    context.system.inventory.max = startingInventory;
  }

  _updateCharacterAttributes(context) {
    const maxAbilities = {};
    for (const ability in context.system.abilities) {
      maxAbilities[ability] = context.system.abilities[ability].max;
    }

    for (let status in context.system.statuses1) {
      const s = context.system.statuses1[status];
      if (!s.value) continue; 

      for (let affected of s.affects) {
        maxAbilities[affected] = (Number(maxAbilities[affected]) - 2) + "";
      }
    }

    for (let status in context.system.statuses2) {
      const s = context.system.statuses2[status];
      if (!s.value) continue;

      for (let affected of s.affects) {
        maxAbilities[affected] = (Number(maxAbilities[affected]) - 2) + "";
      }
    }

    for (const ability in context.system.abilities) {
      context.system.abilities[ability].value = maxAbilities[ability];
    }
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    html.find('.item-edit').click(async ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      if (item?.sheet) {
        item.sheet.render(true);
      }
    });

    html.find('.item-equipMain').click(async ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));

      const equipped = this.actor.items.get(this.actor.data.data.equipped.mainHand);
      const other = this.actor.items.get(this.actor.data.data.equipped.offHand);
      const values = {
        "system.equipped.mainHand": item.id
      };

      if (item.data.data.twoHanded) {
        values["system.equipped.offHand"] = item.id;
      } else if (equipped && equipped.data.data.twoHanded) {
        values["system.equipped.offHand"] = "";
      }
      
      if (other && other.id === item.id) {
        values["system.equipped.offHand"] = "";
      }

      await this.actor.update(values);
    });
    html.find('.item-equipOff').click(async ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));

      const equipped = this.actor.items.get(this.actor.data.data.equipped.offHand);
      const other = this.actor.items.get(this.actor.data.data.equipped.mainHand);
      const values = {
        "system.equipped.offHand": item.id
      };

      if (item.data.data.twoHanded) {
        values["system.equipped.mainHand"] = item.id;
      } else if (equipped && equipped.data.data.twoHanded) {
        values["system.equipped.mainHand"] = "";
      } 

      if (other && other.id === item.id) {
        values["system.equipped.mainHand"] = "";
      }

      await this.actor.update(values);
    });
    html.find('.item-equipArmor').click(async ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));

      const values = {
        "system.equipped.armor": item.id
      };
      await this.actor.update(values);
    });
    html.find('.item-equipAccessory').click(async ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      const values = {
        "system.isEquipped": true
      };
      await item.update(values);
    });
    html.find('.item-unequipAccessory').click(async ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      const values = {
        "system.isEquipped": false
      };
      await item.update(values);
    });
    html.find('.item-equipAccessory2').click(async ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));

      const gives = this.actor.items.filter(i => i.data.data.passive.givesAdditionalAccessorySlot);
      if (gives && gives.length) {
        const values = {
          "system.equipped.accessory2": item.id
        };
        await this.actor.update(values);
      }

      return;
    });

    html.find('.item-summonArcanum').click(async ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      const values = {
        "system.isSummoned": true
      };
      // show in chat
      Dialog.confirm({
        title: game.i18n.localize('FABULAULTIMA.ArcanaMergeInChat'),
        yes: () => this.actor.rollArcanum(item, true, false),
        no: () => { },
        defaultYes: false
      });
      await item.update(values);
    });
    html.find('.item-dismissArcanum').click(async ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      const values = {
        "system.isSummoned": false
      };
      // show in chat
      Dialog.confirm({
        title: game.i18n.localize('FABULAULTIMA.ArcanaDismissInChat'),
        yes: () => this.actor.rollArcanum(item, false, true),
        no: () => { },
        defaultYes: false
      });
      await item.update(values);
    });

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      console.log(li.data("itemId"));
      console.log(item);
      item.delete();
      li.slideUp(200, () => this.render(false));
    });
    html.find('.class-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("classId"));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    html.find('.class-level-sub').click(async ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("classId"));
      const level = item.data.data.level;
      if (level > 1)
        await item.update({
          "system.level": level - 1
        });
    });
    html.find('.class-level-add').click(async ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("classId"));
      await item.update({
        "system.level": item.data.data.level + 1
      });
    });

    html.find('[name="bond.who"]').change(async ev => {
      ev.preventDefault();
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));

      await item.update({
          "system.who": $(ev.currentTarget).val()
      });
    });
    html.find('.feeling-checkbox').click(async ev => {
      ev.preventDefault();
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      const checkbox = $(ev.currentTarget);

      const prop = "system." + ev.currentTarget.dataset.prop;
      const feeling = checkbox.attr('name');

      $("[data-prop='" + ev.currentTarget.dataset.prop + "']").not("[name='" + feeling + "']")[0].checked = false;

      const values = {};

      if (checkbox[0].checked)
        values[prop] = feeling;
      else
        values[prop] = "";

      await item.update(values);
    });
    html.find('.status-checkbox').click(async ev => {
      ev.preventDefault();
      const checkbox = $(ev.currentTarget);
      const status = checkbox.attr('name');

      const values = {};
      values[status] = checkbox[0].checked;

      await this.actor.update(values);
    });

    // Active Effect management
    html.find(".effect-control").click(ev => onManageActiveEffect(ev, this.actor));

    // Rollable abilities.
    html.find('.rollable').click(this._onRoll.bind(this));

    // Drag events for macros.
    if (this.actor.owner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }
  }

  /** @override */
  async _onDropItem(event, data) {
    const item = await Item.implementation.fromDropData(data);
    const other = this.actor.items.filter(i => i.name === item.name);
    const sameActor = this.actor.uuid === item.parent?.uuid;

    if (item.type === "class" && other.length > 0 && !sameActor) {
      // increment level if same class exists
      other[0].update({
        "system.level": other[0].data.data.level + 1
      });
    } else if (item.type === "feature" && other.length > 0 && !sameActor) {
      // increment level if same feature exists
      other[0].update({
        "system.level": other[0].data.data.level + 1
      });
    } else {
      // this is a re-implementation of vanilla logic which differentiates
      // between moving and copying items
      const isCopying = event.ctrlKey;
      if (!this.actor.isOwner)
        return false;
      const itemData = item.toObject();

      // Handle item sorting within the same Actor, unless copying
      if (sameActor && !isCopying)
        return this._onSortItem(event, itemData);

      // Create new item
      const newItem = this._onDropItemCreate(itemData);
      // If the item comes from a different actor (it must have a parent!)
      // and this is not a copying operation, then delete the original
      if (!sameActor && item.parent && !isCopying) {
        await item.delete();
      }
      return ret;
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const data = duplicate(header.dataset);
    const name = `New ${type.capitalize()}`;
    const itemData = {
      name: name,
      type: type,
      data: data
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.data["type"];

    // Finally, create the item!
    return await Item.create(itemData, {parent: this.actor});
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    const itemId = element.closest('.item').dataset.itemId;
    const item = this.actor.items.get(itemId);

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType === 'item') {
        if (item) 
          return item.roll();
      } else if (dataset.rollType === "feature") {
        return this.actor.rollFeature(item);
      } else if (dataset.rollType === "spell") {
        return this.actor.rollSpell(item);
      } else if (dataset.rollType === "weapon") {
        return this.actor.rollWeapon(item);
      }
    }

    // Handle rolls that supply the formula directly.
    /*if (dataset.roll) {
      let label = dataset.label ? `[roll] ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.actor.getRollData()).roll();
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }*/
  }
}
