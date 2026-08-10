const test = require('node:test');
const assert = require('node:assert/strict');
const {
    shuffle, mapAbilityValue, clampTeamCount, resolveTeamCount,
    strataKey, groupIntoStrata, distributeTeams
} = require('./team-draw-logic.js');

test('shuffle: returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = input.slice();
    const result = shuffle(input, () => 0.5);
    assert.deepEqual(input, copy);
    assert.deepEqual([...result].sort(), [1, 2, 3, 4, 5]);
});

test('shuffle: deterministic with rng() always returning 0', () => {
    const result = shuffle([1, 2, 3], () => 0);
    assert.deepEqual(result, [2, 3, 1]);
});

test('mapAbilityValue: maps Korean/English/short forms, trims and lowercases', () => {
    assert.equal(mapAbilityValue('상'), '상');
    assert.equal(mapAbilityValue(' 하 '), '하');
    assert.equal(mapAbilityValue('High'), '상');
    assert.equal(mapAbilityValue('mid'), '중');
    assert.equal(mapAbilityValue('L'), '하');
    assert.equal(mapAbilityValue('모름'), null);
    assert.equal(mapAbilityValue(''), null);
    assert.equal(mapAbilityValue(null), null);
});

test('clampTeamCount: clamps into [2, participantCount]', () => {
    assert.equal(clampTeamCount(1, 10), 2);
    assert.equal(clampTeamCount(20, 10), 10);
    assert.equal(clampTeamCount(3, 10), 3);
    assert.equal(clampTeamCount(3.9, 10), 3);
    assert.equal(clampTeamCount(5, 1), 2);
});

test('resolveTeamCount: count mode returns teamCount as-is', () => {
    assert.equal(resolveTeamCount({ splitBy: 'count', teamCount: 4, teamSize: 3 }, 20), 4);
});

test('resolveTeamCount: size mode ceils participantCount / teamSize', () => {
    assert.equal(resolveTeamCount({ splitBy: 'size', teamCount: 4, teamSize: 4 }, 10), 3);
    assert.equal(resolveTeamCount({ splitBy: 'size', teamCount: 4, teamSize: 5 }, 10), 2);
});

test('strataKey: combines gender and ability only when enabled', () => {
    const p = { name: 'a', gender: 'M', ability: '상' };
    assert.equal(strataKey(p, { balanceGender: false, balanceAbility: false }), '_');
    assert.equal(strataKey(p, { balanceGender: true, balanceAbility: false }), 'M');
    assert.equal(strataKey(p, { balanceGender: false, balanceAbility: true }), '상');
    assert.equal(strataKey(p, { balanceGender: true, balanceAbility: true }), 'M-상');
});

test('strataKey: missing gender/ability become "_"', () => {
    const p = { name: 'a', gender: null, ability: null };
    assert.equal(strataKey(p, { balanceGender: true, balanceAbility: true }), '_-_');
});

test('groupIntoStrata: groups participants by key, preserving original order within a group', () => {
    const participants = [
        { name: 'a', gender: 'M', ability: null },
        { name: 'b', gender: 'F', ability: null },
        { name: 'c', gender: 'M', ability: null }
    ];
    const groups = groupIntoStrata(participants, { balanceGender: true, balanceAbility: false });
    assert.deepEqual(groups.M.map(p => p.name), ['a', 'c']);
    assert.deepEqual(groups.F.map(p => p.name), ['b']);
});

test('distributeTeams: every participant appears exactly once, team count matches', () => {
    const participants = Array.from({ length: 12 }, (_, i) => ({ name: `p${i}`, gender: null, ability: null }));
    const teams = distributeTeams(participants, 4, {});
    assert.equal(teams.length, 4);
    const allMembers = teams.flatMap(t => t.members).map(m => m.name).sort();
    assert.deepEqual(allMembers, participants.map(p => p.name).sort());
});

test('distributeTeams: uneven split keeps team sizes within 1 of each other', () => {
    const participants = Array.from({ length: 10 }, (_, i) => ({ name: `p${i}`, gender: null, ability: null }));
    const teams = distributeTeams(participants, 3, {});
    const sizes = teams.map(t => t.members.length);
    assert.equal(sizes.reduce((a, b) => a + b, 0), 10);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
});

test('distributeTeams: balanceGender keeps each team gender counts within 1 of each other', () => {
    const participants = [
        ...Array.from({ length: 6 }, (_, i) => ({ name: `m${i}`, gender: 'M', ability: null })),
        ...Array.from({ length: 6 }, (_, i) => ({ name: `f${i}`, gender: 'F', ability: null }))
    ];
    const teams = distributeTeams(participants, 4, { balanceGender: true });
    const mCounts = teams.map(t => t.members.filter(m => m.name.startsWith('m')).length);
    const fCounts = teams.map(t => t.members.filter(m => m.name.startsWith('f')).length);
    assert.ok(Math.max(...mCounts) - Math.min(...mCounts) <= 1);
    assert.ok(Math.max(...fCounts) - Math.min(...fCounts) <= 1);
});

test('distributeTeams: balanceAbility keeps each team ability-tier counts within 1 of each other', () => {
    const participants = [
        ...Array.from({ length: 6 }, (_, i) => ({ name: `h${i}`, gender: null, ability: '상' })),
        ...Array.from({ length: 6 }, (_, i) => ({ name: `l${i}`, gender: null, ability: '하' }))
    ];
    const teams = distributeTeams(participants, 4, { balanceAbility: true });
    const hCounts = teams.map(t => t.members.filter(m => m.name.startsWith('h')).length);
    const lCounts = teams.map(t => t.members.filter(m => m.name.startsWith('l')).length);
    assert.ok(Math.max(...hCounts) - Math.min(...hCounts) <= 1);
    assert.ok(Math.max(...lCounts) - Math.min(...lCounts) <= 1);
});

test('distributeTeams: balanceGender + balanceAbility together does not crash and preserves membership', () => {
    const participants = [
        { name: 'a', gender: 'M', ability: '상' },
        { name: 'b', gender: 'M', ability: '하' },
        { name: 'c', gender: 'F', ability: '중' },
        { name: 'd', gender: 'F', ability: null },
        { name: 'e', gender: null, ability: '상' },
        { name: 'f', gender: null, ability: null }
    ];
    const teams = distributeTeams(participants, 2, { balanceGender: true, balanceAbility: true });
    const allMembers = teams.flatMap(t => t.members).map(m => m.name).sort();
    assert.deepEqual(allMembers, participants.map(p => p.name).sort());
});

test('distributeTeams: teamCount equal to participant count gives every team exactly one member', () => {
    const participants = Array.from({ length: 4 }, (_, i) => ({ name: `p${i}`, gender: null, ability: null }));
    const teams = distributeTeams(participants, 4, {});
    teams.forEach(t => assert.equal(t.members.length, 1));
});
