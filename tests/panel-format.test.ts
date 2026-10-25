import assert from "node:assert/strict";
import test from "node:test";
import { panelLiteral, panelValues } from "../src/panel-format";

test("reads a v2 literal scalar and a legacy v1 mapping", () => {
	assert.deepEqual(panelValues(panelLiteral("lucide:book-open", "#0ea5e9")), {
		icon: "lucide:book-open",
		accent: "#0ea5e9",
	});
	assert.deepEqual(
		panelValues({ icon: "lucide:terminal", accent: "#AABBCC" }),
		{
			icon: "lucide:terminal",
			accent: "#AABBCC",
		},
	);
});

test("rejects malformed literal scalar structure", () => {
	assert.equal(
		panelValues("icon: lucide:book-open\nicon: lucide:terminal\n"),
		null,
	);
	assert.equal(
		panelValues('icon: lucide:book-open\naccent: "#123456"\nextra: x\n'),
		null,
	);
});
