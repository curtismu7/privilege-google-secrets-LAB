# Talk track

<!-- Generated from server/src/story.js by `npm run talk-track`. Do not edit by hand. -->

## The story in one line

An AI agent that needs a Google credential should never hold one. It holds a Privilege agent access key and asks the Hubs gateway; policy decides per secret whether the ask is allowed.

## The key is an identity, not a key ring

The agent access key identifies the agent to the gateway. It opens nothing by itself: every ask goes through policy, and the policy lists which secrets this agent may read.

## The refusal is the product

The demo's key beat is the second card: the same key asking for a billing secret is refused with Gateway Policy Denied. Show the trace — the custodian step reads NOT REACHED, the secret never moved.

## What the trace proves

Every call shows the request, the response, and the decisions in between: key recognised, policy evaluated, decision, custodian release on an allow. Nothing secret goes in the trace; the one shown payload is a mock credential, labelled.

## Why this beats a static key

No secret on the agent host to steal. Policy per secret instead of all-or-nothing. An audit trail keyed to the agent. With a static credential pasted in a config file, all three lines are worse.

## Honesty

Everything here is a simulation: mock gateway, mock custodian, mock Google Secret Manager, mock-issued secret labelled MOCK. What the real product does with these shapes is labelled UNVERIFIED on the Facts tab.

## The scenarios

1. **An in-scope secret is released.** The agent presents its key and asks for projects/demo/secrets/google-agent-credential. Policy: the secret is on the key's grant. Custodian: releases version 3 into the session. The payload is MOCK-issued and labelled.
2. **An out-of-scope secret is refused — the refusal is the product.** The same key asks for the billing secret. Policy: not on the grant list. Gateway Policy Denied, custodian never reached, and the refusal is recorded with the agent's identity.
3. **An unknown secret is refused too.** A secret that does not exist in the mock store is refused as "no such secret" — and the refusal shape is the same as the out-of-scope one: the agent learns nothing about what does exist.
4. **A wrong key gets nothing at all.** Present a key that is not the registered agent key and the gateway refuses at the identity step: 401, policy not reached, no information about the policy beyond the fact of the refusal.
5. **Why this beats a static key.** Three lines: no secret in the agent (nothing to steal from the agent host), policy per secret (the same key cannot read everything it can name), and an audit trail keyed to the agent rather than to a shared credential.
