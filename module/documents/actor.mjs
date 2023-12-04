/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class FabulaUltimaActor extends Actor {

  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
    const actorData = this.system;


    // Calculate initiative & defenses now, so that active effects can modify them
    actorData.initiativeBonus = 0;
    actorData.defense = parseInt(actorData.abilities.dex.value);
    actorData.magicDefense = parseInt(actorData.abilities.int.value);

    // bonuses on enemies
    if (actorData.defenseBonus) {
      actorData.defense += parseInt(actorData.defenseBonus);
    }
    if (actorData.magicDefenseBonus) {
      actorData.magicDefense += parseInt(actorData.magicDefenseBonus);
    }

    if (actorData.equipped.armor !== "") {
      const armor = this.items.get(actorData.equipped.armor);
      if (armor) {
        actorData.initiativeBonus = parseInt(armor.system.initiativeBonus);

        if (armor.system.defenseFormula.includes("@")) {
          const roll = new Roll(armor.system.defenseFormula, this.getRollData()).roll({ async: false });
          actorData.defense = parseInt(roll.total);
        } else {
          actorData.defense = parseInt(armor.system.defenseFormula);
        }

        if (armor.system.magicDefenseFormula.includes("@")) {
          const roll = new Roll(armor.system.magicDefenseFormula, this.getRollData()).roll({ async: false });
          actorData.magicDefense = parseInt(roll.total);
        } else {
          actorData.magicDefense = parseInt(armor.system.magicDefenseFormula);
        }
      }
    }

    let mainHand;
    if (actorData.equipped.mainHand !== "") {
      mainHand = this.items.get(actorData.equipped.mainHand);
      if (mainHand) {
        if (mainHand.system.quality) {
          actorData.initiativeBonus += parseInt(mainHand.system.quality.initiativeBonus);
          actorData.defense += parseInt(mainHand.system.quality.defenseBonus);
          actorData.magicDefense += parseInt(mainHand.system.quality.magicDefenseBonus);
        }

        actorData.defense += parseInt(mainHand.system.defenseBonus);
        actorData.magicDefense += parseInt(mainHand.system.magicDefenseBonus);
      }
    }

    if (actorData.equipped.offHand !== "") {
      const offHand = this.items.get(actorData.equipped.offHand);
      if (offHand && mainHand && mainHand.id !== offHand.id) {
        if (offHand.system.quality) {
          actorData.initiativeBonus += parseInt(offHand.system.quality.initiativeBonus);
          actorData.defense += parseInt(offHand.system.quality.defenseBonus);
          actorData.magicDefense += parseInt(offHand.system.quality.magicDefenseBonus);
        }

        actorData.defense += parseInt(offHand.system.defenseBonus);
        actorData.magicDefense += parseInt(offHand.system.magicDefenseBonus);
      }
    }

    for (let item of this.items) {
      let initBonus, defBonus, mdefBonus;
      // handle all equipped accessories
      if (item.type === 'accessory' && item.system.isEquipped && item.system.quality) {
        initBonus = Number(item.system.quality.initiativeBonus);
        defBonus = Number(item.system.quality.defenseBonus);
        mdefBonus = Number(item.system.quality.magicDefenseBonus);
      }
      // handle bonuses from features
      if (item.type === 'feature') {
        const level = Number(item.system.level);
        if (isNaN(level))
          continue;
        initBonus = Number(item.system.passive.initiativeBonus) * level;
        defBonus = Number(item.system.passive.defenseBonus) * level;
        mdefBonus = Number(item.system.passive.magicDefenseBonus) * level;
      }
      if (!isNaN(initBonus))
        actorData.initiativeBonus += initBonus;
      if (!isNaN(defBonus))
        actorData.defense += defBonus;
      if (!isNaN(mdefBonus))
        actorData.magicDefense += mdefBonus;
    }

  }

  /**
   * @override
   * Augment the basic actor data with additional dynamic data. Typically,
   * you'll want to handle most of your calculated/derived data in this step.
   * Data calculated in this step should generally not exist in template.json
   * (such as ability modifiers rather than ability scores) and should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    const actorData = this.system;

    // Make separate methods for each Actor type (character, npc, etc.) to keep
    // things organized.
    this._prepareCharacterData(actorData);
    this._prepareNpcData(actorData);
  }

  /**
   * Prepare Character type specific data
   */
  _prepareCharacterData(actorData) {
    if (this.type !== 'character') return;

    actorData.health.max = this.getMaxHealthPoints();
    actorData.mind.max = this.getMaxMindPoints();
    actorData.inventory.max = this.getMaxInventoryPoints();
  }

  /**
   * Prepare NPC type specific data.
   */
  _prepareNpcData(actorData) {
    if (actorData.type !== 'npc') return;

    // Make modifications to data here. For example:
    //const data = actorData.data;
    //data.xp = (data.cr * data.cr) * 100;
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  getRollData() {
    const data = super.getRollData();

    // Prepare character roll data.
    this._getCharacterRollData(data);
    this._getNpcRollData(data);

    return data;
  }

  isCrisis() {
    return this.system.health.value <= Math.floor(this.system.health.max / 2);
  }

  async initiativeRoll(bondBonus = 0) {
    return this.roll("dex", "int", bondBonus + this.system.initiativeBonus, "FABULAULTIMA.InitiativeTest");
  }

  async roll(firstAbility, secondAbility, bonus = 0, label = "FABULAULTIMA.GenericTest") {
    const templateData = {
      actor: this,
      type: this.type
    };

    let formula = this.getBaseRollFormula(firstAbility, secondAbility, bonus);

    const roll = await new Roll(formula, this.getRollData()).roll({ async: true });
    const d = roll.dice;

    const maxVal = d.reduce(function (a, b) {
      return Math.max(a.total, b.total);
    });

    const isFumble = d.every(die => die.total === 1);
    const isCrit = d.every(die => die.total === d[0].total && die.total !== 1 && die.total > 5); // TODO frenesia

    templateData["formula"] = this.getGenericFormula(firstAbility, secondAbility, bonus);
    templateData["total"] = roll.total;
    templateData["dice"] = roll.dice;
    templateData["isCritical"] = isCrit;
    templateData["isFumble"] = isFumble;
    templateData["label"] = game.i18n.localize(label);

    const template = "systems/fabulaultima/templates/chat/base-card.html";
    const html = await renderTemplate(template, templateData);

    const chatData = {
      user: game.user._id,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      content: html,
      rollMode: game.settings.get("core", "rollMode"),
      roll: roll,
      speaker: {
        token: this.token ? this.token.id : null,
        alias: this.token ? this.token.name : this.name,
        actor: this._id
      }
    };

    return ChatMessage.create(chatData);
  }

  async rollFeature(feature) {
    const templateData = {
      actor: this,
      feature: feature,
      type: this.type,
      flavor: feature.name
    };

    const template = "systems/fabulaultima/templates/chat/feature-card.html";
    const html = await renderTemplate(template, templateData);

    let token = this.token;
    if (!token) {
      token = this.getActiveTokens()[0];
    }

    const chatData = {
      user: game.user._id,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      content: html,
      speaker: {
        token: this.token ? this.token.id : null,
        alias: this.token ? this.token.name : this.name,
        actor: this.id
      }
    };

    return ChatMessage.create(chatData);
  }

  async rollSkilloption(skilloption) {
    // localize resource
    skilloption.system.cost.resourceLoc = game.i18n.localize(CONFIG.FABULAULTIMA.costResources[skilloption.system.cost.resource]);

    const templateData = {
      actor: this,
      skilloption: skilloption,
      type: this.type,
      flavor: skilloption.name,
    };

    let roll = undefined;

    if (skilloption.system.formula) {
      roll = await new Roll(skilloption.system.formula, this.getRollData()).roll({ async: true });
      const d = roll.dice;
      const isFumble = d.every(die => die.total === 1);
      const isCrit = d.every(die => die.total === d[0].total && die.total !== 1 && die.total > 5); // TODO frenesia
      templateData["formula"] = skilloption.system.formula;
      templateData["total"] = roll.total;
      templateData["dice"] = roll.dice;
      templateData["isCritical"] = isCrit;
      templateData["isFumble"] = isFumble;
    }

    const template = "systems/fabulaultima/templates/chat/skilloption-card.html";
    const html = await renderTemplate(template, templateData);

    let token = this.token;
    if (!token) {
      token = this.getActiveTokens()[0];
    }

    const chatData = {
      user: game.user._id,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      content: html,
      speaker: {
        token: this.token ? this.token.id : null,
        alias: this.token ? this.token.name : this.name,
        actor: this.id
      }
    };
    if (roll) {
      chatData['roll'] = roll;
      chatData['rollMode'] = game.settings.get("core", "rollMode");
      chatData['type'] = CONST.CHAT_MESSAGE_TYPES.ROLL;
    }

    return ChatMessage.create(chatData);
  }

  async rollSpell(spell) {

    const templateData = {
      actor: this,
      spell: spell,
      type: this.type,
      flavor: spell.name
    };

    let roll = undefined;

    if (spell.system.isOffensive) {
      // game.i18n.localize("FABULAULTIMA.RollPrecisionTest");

      let precisionBonus = Number(spell.system.precisionBonus);
      let damageBonus = Number(spell.system.damage.bonus);
      const features = this.items.filter(i => i.type === "feature");
      for (const feature of features) {
        const prcBonus = Number(feature.system.passive.magicPrecisionBonus);
        const damBonus = Number(feature.system.passive.magicDamageBonus);
        const level = Number(feature.system.level);
        if (!this.checkFeatureCondition(feature))
          continue;
        if (!isNaN(prcBonus) && !isNaN(level))
          precisionBonus += (prcBonus * level);
        if (!isNaN(damBonus) && !isNaN(level))
          damageBonus += (damBonus * level);
      }
      let formula = this.getBaseRollFormula(spell.system.firstAbility, spell.system.secondAbility, precisionBonus);

      roll = await new Roll(formula, this.getRollData()).roll({ async: true });
      const d = roll.dice;

      const maxVal = d.reduce(function (a, b) {
        return Math.max(a.total, b.total);
      });

      const isFumble = d.every(die => die.total === 1);
      const isCrit = d.every(die => die.total === d[0].total && die.total !== 1 && die.total > 5);

      const first = game.i18n.localize(CONFIG.FABULAULTIMA.abilityAbbreviations[spell.system.firstAbility]);
      const second = game.i18n.localize(CONFIG.FABULAULTIMA.abilityAbbreviations[spell.system.secondAbility]);
      templateData["formula"] = "【" + first + " + " + second + "】";
      if (precisionBonus != 0) {
        templateData["formula"] += " + " + precisionBonus;
      }
      templateData["total"] = roll.total;
      templateData["dice"] = roll.dice;
      if (spell.system.damage.type != 'none' || damageBonus) {
        templateData["damage"] = maxVal + damageBonus;
        templateData["damageType"] = spell.system.damage.type;
        templateData["damageTypeLoc"] = game.i18n.localize(CONFIG.FABULAULTIMA.damageTypes[templateData["damageType"]]);
      }
      templateData["isCritical"] = isCrit;
      templateData["isFumble"] = isFumble;
    }
    const template = "systems/fabulaultima/templates/chat/spell-card.html";
    const html = await renderTemplate(template, templateData);

    let token = this.token;
    if (!token) {
      token = this.getActiveTokens()[0];
    }

    const chatData = {
      user: game.user._id,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      content: html,
      speaker: {
        token: this.token ? this.token.id : null,
        alias: this.token ? this.token.name : this.name,
        actor: this.id
      }
    };
    if (roll) {
      chatData['roll'] = roll;
      chatData['rollMode'] = game.settings.get("core", "rollMode");
      chatData['type'] = CONST.CHAT_MESSAGE_TYPES.ROLL;
    }

    return ChatMessage.create(chatData);

  }

  async rollArcanum(arcanum, {showMerge = false, showPulse = false, showDismiss = false}={}) {
    const templateData = {
      actor: this,
      arcanum: arcanum,
      type: this.type,
      flavor: arcanum.name,
      showMerge: showMerge,
      showPulse: showPulse,
      showDismiss: showDismiss,
    };

    const template = "systems/fabulaultima/templates/chat/arcanum-card.html";
    const html = await renderTemplate(template, templateData);

    let token = this.token;
    if (!token) {
      token = this.getActiveTokens()[0];
    }

    const chatData = {
      user: game.user._id,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      content: html,
      speaker: {
        token: this.token ? this.token.id : null,
        alias: this.token ? this.token.name : this.name,
        actor: this.id
      }
    };

    return ChatMessage.create(chatData);
  }

  async rest() {
    const values = {
      "system.health.value": this.system.health.max,
      "system.mind.value": this.system.mind.max
    };
    return this.update(values);
  }

  async rollWeapon(weapon) {
    const flavour = game.i18n.localize("FABULAULTIMA.RollPrecisionTest");

    const templateData = {
      actor: this,
      item: weapon.data,
      type: this.type,
      flavor: flavour
    };

    let formula = this.getRollFormula(weapon.data);

    const roll = await new Roll(formula, this.getRollData()).roll({ async: true });
    const d = roll.dice;

    const maxVal = d.reduce(function (a, b) {
      return Math.max(a.total, b.total);
    });

    const isFumble = d.every(die => die.total === 1);
    const isCrit = d.every(die => die.total === d[0].total && die.total !== 1 && die.total > 5);

    templateData["formula"] = this.getItemFormula(weapon.data);
    templateData["total"] = roll.total;
    templateData["dice"] = roll.dice;
    templateData["damageType"] = weapon.system.damage.type;
    templateData["damageTypeLoc"] = game.i18n.localize(CONFIG.FABULAULTIMA.damageTypes[templateData["damageType"]]);
    templateData["damage"] = maxVal + this.getWeaponTotalDamage(weapon);
    templateData["isCritical"] = isCrit;
    templateData["isFumble"] = isFumble;

    const template = "systems/fabulaultima/templates/chat/weapon-card.html";
    const html = await renderTemplate(template, templateData);

    let token = this.token;
    if (!token) {
      token = this.getActiveTokens()[0];
    }

    const chatData = {
      user: game.user._id,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      content: html,
      rollMode: game.settings.get("core", "rollMode"),
      roll: roll,
      speaker: {
        token: this.token ? this.token.id : null,
        alias: this.token ? this.token.name : this.name,
        actor: this.id
      }
    };

    return ChatMessage.create(chatData);
  }

  getWeaponTotalDamage(weapon) {
    let baseDamage = weapon.system.damage.bonus;
    const isMelee = weapon.system.type === "melee";

    const features = this.items.filter(i => i.type === "feature");
    for (const feature of features) {
      const bonus = Number(isMelee ? feature.system.passive.meleeDamageBonus : feature.system.passive.rangedDamageBonus);
      const level = Number(feature.system.level);
      if (isNaN(bonus) || isNaN(level)) continue;
      if (!this.checkFeatureCondition(feature)) continue;

      baseDamage += (bonus * level);
    }

    return baseDamage;
  }

  getItemFormula(item) {
    if (item.type === "weapon")
      return this.getWeaponFormula(item);

    return "";
  }

  getWeaponFormula(item) {
    let weaponBonus = item.system.precisionBonus;
    const isMelee = item.system.type === "melee";

    const features = this.items.filter(i => i.type === "feature");
    for (const feature of features) {
      const bonus = Number(isMelee ? feature.system.passive.meleePrecisionBonus : feature.system.passive.rangedPrecisionBonus);
      const level = Number(feature.system.level);
      if (isNaN(bonus) || isNaN(level)) continue;
      if (!this.checkFeatureCondition(feature)) continue;

      weaponBonus += (bonus * level);
    }

    const first = game.i18n.localize(CONFIG.FABULAULTIMA.abilityAbbreviations[item.system.firstAbility]);
    const second = game.i18n.localize(CONFIG.FABULAULTIMA.abilityAbbreviations[item.system.secondAbility]);
    let base = "【" + first + " + " + second + "】";
    if (weaponBonus !== 0) {
      base += " + " + weaponBonus;
    }
    return base;
  }

  getLevel() {
    let level = 0;

    const classes = this.items.filter(i => i.type === "class");
    for (let c of classes) {
      level += c.system.level;
    }

    return level;
  }

  getMaxHealthPoints() {
    let startingHealth = this.system.abilities.vig.max * 5;
    startingHealth += this.getLevel();

    const classes = this.items.filter(i => i.type === "class");
    for (let c of classes) {
      startingHealth += Number(c.system.healthBonus);
    }

    const skills = this.items.filter(i => i.type === "feature");
    for (let f of skills) {
      startingHealth += Number(f.system.passive.hpBonus) * f.system.level;
    }

    return startingHealth;
  }

  getMaxMindPoints() {
    let startingMind = this.system.abilities.vol.max * 5;
    startingMind += this.getLevel();

    const classes = this.items.filter(i => i.type === "class");
    for (let c of classes) {
      startingMind += Number(c.system.mindBonus);
    }

    const skills = this.items.filter(i => i.type === "feature");
    for (let f of skills) {
      startingMind += Number(f.system.passive.mpBonus) * f.system.level;
    }

    return startingMind;
  }

  getMaxInventoryPoints() {
    let startingInventory = 6;

    const classes = this.items.filter(i => i.type === "class");
    for (let c of classes) {
      startingInventory += Number(c.system.inventoryBonus);
    }

    const skills = this.items.filter(i => i.type === "feature");
    for (let f of skills) {
      startingInventory += Number(f.system.passive.ipBonus);
    }

    return startingInventory;
  }

  getArmorFormula(item, magic) {
    let base = item.system.defenseFormula;
    if (magic)
      base = item.system.magicDefenseFormula;

    if (base.includes("@")) {
      for (const ability in CONFIG.FABULAULTIMA.abilities) {
        const abbr = game.i18n.localize(CONFIG.FABULAULTIMA.abilityAbbreviations[ability]);
        base = base.replace("@" + ability, abbr);
      }
    }

    return base;
  }

  getGenericFormula(firstAbility, secondAbility, bonus = 0) {
    const first = game.i18n.localize(CONFIG.FABULAULTIMA.abilityAbbreviations[firstAbility]);
    const second = game.i18n.localize(CONFIG.FABULAULTIMA.abilityAbbreviations[secondAbility]);
    let base = "【" + first + "+ " + second + "】";
    if (bonus !== 0) {
      base += " + " + bonus;
    }
    return base;
  }

  getRollFormula(item) {
    let weaponBonus = item.system.precisionBonus;
    const isMelee = item.system.type === "melee";

    const features = this.items.filter(i => i.type === "feature");
    for (const feature of features) {
      const bonus = Number(isMelee ? feature.system.passive.meleePrecisionBonus : feature.system.passive.rangedPrecisionBonus);
      const level = Number(feature.system.level);
      if (isNaN(bonus) || isNaN(level)) continue;
      if (!this.checkFeatureCondition(feature)) continue;

      weaponBonus += (bonus * level);
    }

    return this.getBaseRollFormula(item.system.firstAbility, item.system.secondAbility, weaponBonus);
  }

  checkFeatureCondition(feature) {
    if (!feature.system.passive.condition || feature.system.passive.condition === "")
      return true;

    if (feature.system.passive.condition === "crisis")
      return this.isCrisis();
    if (feature.system.passive.condition === "fullhealth")
      return this.system.health.value === this.system.health.max;

    if (feature.system.passive.condition.includes("effect:")) {
      const effect = feature.system.passive.condition.split(":")[1];
      if (effect && effect !== "")
        return this.effects.some(e => e.name === effect || e.system.label === effect);
    }

    return false;
  }

  getBaseRollFormula(firstAbility, secondAbility, bonus = 0) {
    let base = `1d@abilities.${firstAbility}.value + 1d@abilities.${secondAbility}.value`;
    if (bonus !== 0) {
      base += " + " + bonus;
    }
    return base;
  }

  /**
   * Prepare character roll data.
   */
  _getCharacterRollData(data) {
    if (this.type !== 'character') return;

    // Copy the ability scores to the top level, so that rolls can use
    // formulas like `@str.mod + 4`.
    if (data.abilities) {
      for (let [k, v] of Object.entries(data.abilities)) {
        data[k] = (foundry.utils.deepClone(v)).value;
      }
    }

    // Add level for easier access, or fall back to 0.
    /*if (data.attributes.level) {
      data.lvl = data.attributes.level.value ?? 0;
    }*/
  }

  /**
   * Prepare NPC roll data.
   */
  _getNpcRollData(system) {
    if (this.type !== 'npc') return;

    // Process additional NPC data here.
  }

}