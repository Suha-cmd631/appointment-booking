// Settings for the tests (npm test).
module.exports = {
    testEnvironment: "node",
    testMatch: ["<rootDir>/tests/**/*.test.js"],
    globalSetup: "<rootDir>/tests/helpers/global-setup.js",
    globalTeardown: "<rootDir>/tests/helpers/global-teardown.js",
    testSequencer: "<rootDir>/tests/helpers/order.js",
    testTimeout: 120000,
    maxWorkers: 1,
    verbose: true,
    reporters: [
        "default",
        ["jest-html-reporter", {
            pageTitle: "BOOK N MEET - Test Report",
            outputPath: "test-report/test-report.html",
            includeFailureMsg: true,
            dateFormat: "dd mmm yyyy, HH:MM"
        }]
    ]
};
