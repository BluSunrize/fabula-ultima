
export class FabulaRoll extends Roll {

  constructor(formula, data = {}, options = {}) {
    super(formula, data, options);
    this._templateData = data.templateData;
  }

  get highroll() {
    return this.dice.reduce((a, b) => a.total > b.total ? a : b);
  }

  get isFumble() {
    return this.dice.every(die => die.total === 1);
  }

  get isCrit() {
    return this.dice.every(die => die.total === this.dice[0].total && die.total > 5);
  }

  rerollDice(dieIndex = undefined) {
    if (dieIndex === undefined)
      this.dice.forEach(FabulaRoll._rerollDie);
    else
      FabulaRoll._rerollDie(this.dice[dieIndex]);
    this._evaluated = false;
    this.evaluate({ async: false });
  }

  static _rerollDie(die) {
    die.results.splice(0, die.results.length);
    die.roll();
  }

  static create(formula, data = {}, options = {}, templateData = {}) {
    return new FabulaRoll(formula, data, options, templateData);
  }

  static rerollChatMessage(message, html, dieIndex = undefined) {
    const content = html.find('.message-content').clone();
    // Remove context menu that got us here
    content.find('#context-menu').remove();

    // Change individual dice
    const roll = message.roll;
    roll.rerollDice(dieIndex);
    roll.dice.forEach((die, id) => {
      content.find(`li[data-dieId="${id}"]`)
        .text(die.total)
        .removeClass()
        .addClass('roll')
        .addClass(die.getResultCSS(die.results.find(r => r.active)));
    });

    // Update precision total
    content.find('.precision.dice-total').text(roll.total);

    // Update highroll
    const highroll = roll.highroll;
    content.find(`li[data-dieId="highroll"]`)
      .text(highroll.total)
      .removeClass()
      .addClass('roll')
      .addClass(highroll.getResultCSS(highroll.results.find(r => r.active)));

    // Update damage total
    const total = content.find('.damage.dice-total span[data-bonus]');
    total.text(highroll.total + Number(total.data('bonus')));

    // Perform upate on chat message
    message.update({
      roll: roll.toJSON(),
      rolls: message.rolls.concat(roll).map(r => r.toJSON()),
      content: content.html().trim(),
    });
  }
}