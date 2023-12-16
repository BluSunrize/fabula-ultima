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
    return `systems/fabulaultima/templates/actor/actor-${this.actor.type}-sheet.html`;
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
    context.flags = context.actor.flags;

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
    const skilloptions = {};
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
 
        i.system.category = game.i18n.localize(CONFIG.FABULAULTIMA.weaponCategories[i.system.category]);
        i.system.type = game.i18n.localize(CONFIG.FABULAULTIMA.weaponTypes[i.system.type]);
        i.system.damage.type = game.i18n.localize(CONFIG.FABULAULTIMA.damageTypes[i.system.damage.type]);

        if (i.system.twoHanded) {
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
        i.system.defenseFormula = this.actor.getArmorFormula(i, false);
        i.system.magicDefenseFormula = this.actor.getArmorFormula(i, true);

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
      else if (i.type === 'skilloption') {
        let option_category = i.system.category || '';
        if (!skilloptions.hasOwnProperty(option_category)) {
          skilloptions[option_category] = [];
        }
        // localize resources for display
        i.system.cost.resourceLoc = game.i18n.localize(CONFIG.FABULAULTIMA.costResources[i.system.cost.resource]);
        skilloptions[option_category].push(i);
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
        i.system.cost.resource = game.i18n.localize(CONFIG.FABULAULTIMA.costResources[i.system.cost.resource]);

        const cls = i.system.class;
        const c = classes.find(cl => cl.system.abbr === cls);
        if (c) {
          c.skills.push(i);
        }
      }
      // Append to spells.
      else if (i.type === 'spell') {
        i.system.cost.resource = game.i18n.localize(CONFIG.FABULAULTIMA.costResources[i.system.cost.resource]);

        const cls = i.system.class;
        const c = classes.find(cl => cl.system.abbr === cls);
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
    context.skilloptions = skilloptions;
  }

  _updateCharacterLevel(context) {
    let level = 0;

    for (let c of context.classes) {
      level += c.system.level;
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
      startingHealth += Number(c.system.healthBonus);
      startingMind += Number(c.system.mindBonus);
      startingInventory += Number(c.system.inventoryBonus);

      for (let f of c.skills) {
        startingHealth += Number(f.system.passive.hpBonus) * f.system.level;
        startingMind += Number(f.system.passive.mpBonus) * f.system.level;
        startingInventory += Number(f.system.passive.ipBonus);
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
        maxAbilities[affected] = Math.max((Number(maxAbilities[affected]) - 2), 6) + "";
      }
    }

    for (let status in context.system.statuses2) {
      const s = context.system.statuses2[status];
      if (!s.value) continue;

      for (let affected of s.affects) {
        maxAbilities[affected] = Math.max((Number(maxAbilities[affected]) - 2), 6) + "";
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

      const equipped = this.actor.items.get(this.actor.system.equipped.mainHand);
      const other = this.actor.items.get(this.actor.system.equipped.offHand);
      const values = {
        "system.equipped.mainHand": item.id
      };

      if (item.system.twoHanded) {
        values["system.equipped.offHand"] = item.id;
      } else if (equipped && equipped.system.twoHanded) {
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

      const equipped = this.actor.items.get(this.actor.system.equipped.offHand);
      const other = this.actor.items.get(this.actor.system.equipped.mainHand);
      const values = {
        "system.equipped.offHand": item.id
      };

      if (item.system.twoHanded) {
        values["system.equipped.mainHand"] = item.id;
      } else if (equipped && equipped.system.twoHanded) {
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

      const gives = this.actor.items.filter(i => i.system.passive.givesAdditionalAccessorySlot);
      if (gives && gives.length) {
        const values = {
          "system.equipped.accessory2": item.id
        };
        await this.actor.update(values);
      }

      return;
    });

    // Handle arcanum summoning / dismissing, the context menu is on a unique event-trigger
    // which is in turn only performed by the roll button
    html.find('li.arcanum a.rollable').click(async ev => {
      ev.stopPropagation();
      $(ev.currentTarget).parents('li.arcanum')[0].dispatchEvent(new Event('arcanum_menu', {bubbles: true}));
    });
    new ContextMenu(html, 'li.arcanum', [
      {
        name: 'FABULAULTIMA.Merge',
        icon: '<i class="fa-solid fa-dragon"></i>',
        condition: li => {
          const item = this.actor.items.get(li.data('itemId'));
          return !item.system.isSummoned;
        },
        callback: li => {
          const item = this.actor.items.get(li.data('itemId'));
          const values = {
            "system.isSummoned": true
          };
          this.actor.rollArcanum(item, {showMerge: true});
          item.update(values);
        }
      },
      {
        name: 'FABULAULTIMA.Pulse',
        icon: '<i class="fa-solid fa-fire"></i>',
        condition: li => {
          const item = this.actor.items.get(li.data('itemId'));
          return item.system.isSummoned;
        },
        callback: li => {
          const item = this.actor.items.get(li.data('itemId'));
          this.actor.rollArcanum(item, {showPulse: true});
        }
      },
      {
        name: 'FABULAULTIMA.Dismiss',
        icon: '<i class="fa-thin fa-dragon"></i>',
        condition: li => {
          const item = this.actor.items.get(li.data('itemId'));
          return item.system.isSummoned;
        },
        callback: li => {
          const item = this.actor.items.get(li.data('itemId'));
          const values = {
            "system.isSummoned": false
          };
          this.actor.rollArcanum(item, {showDismiss: true});
          item.update(values);
        }
      },
      {
        name: 'FABULAULTIMA.DismissNoMessage',
        icon: '<i class="fa-solid fa-ban"></i>',
        condition: li => {
          const item = this.actor.items.get(li.data('itemId'));
          return item.system.isSummoned;
        },
        callback: li => {
          const item = this.actor.items.get(li.data('itemId'));
          const values = {
            "system.isSummoned": false
          };
          item.update(values);
        }
      },
    ], {
      eventName: 'arcanum_menu',
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
      const level = item.system.level;
      if (level > 1)
        await item.update({
          "system.level": level - 1
        });
    });
    html.find('.class-level-add').click(async ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("classId"));
      await item.update({
        "system.level": item.system.level + 1
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
        "system.level": other[0].system.level + 1
      });
    } else if (item.type === "feature" && other.length > 0 && !sameActor) {
      // increment level if same feature exists
      other[0].update({
        "system.level": other[0].system.level + 1
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
      } else if (dataset.rollType === "skilloption") {
        return this.actor.rollSkilloption(item);
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
