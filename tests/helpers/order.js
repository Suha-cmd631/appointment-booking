// Run the test files in a fixed order: accounts, appointments, staff, then the website.
const Sequencer = require("@jest/test-sequencer").default;
module.exports = class extends Sequencer {
    sort(tests) {
        return [...tests].sort((a, b) => a.path.localeCompare(b.path));
    }
};
