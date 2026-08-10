// team-draw-logic.js
// 팀 나누기 순수 로직. DOM에 의존하지 않으며 브라우저(<script> 전역)와 Node.js(CommonJS) 양쪽에서 동작한다.
(function (global) {
    'use strict';

    function shuffle(arr, rng) {
        rng = rng || Math.random;
        const result = arr.slice();
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            const tmp = result[i];
            result[i] = result[j];
            result[j] = tmp;
        }
        return result;
    }

    const ABILITY_MAP = {
        '상': '상', '중': '중', '하': '하',
        'high': '상', 'mid': '중', 'medium': '중', 'low': '하',
        'h': '상', 'm': '중', 'l': '하'
    };

    function mapAbilityValue(raw) {
        if (raw === null || raw === undefined) return null;
        const key = String(raw).trim().toLowerCase();
        return ABILITY_MAP[key] || null;
    }

    function clampTeamCount(count, participantCount) {
        const max = Math.max(participantCount, 0);
        let n = Math.floor(Number(count));
        if (!Number.isFinite(n)) n = 2;
        if (n < 2) return 2;
        if (max < 2) return 2;
        if (n > max) return max;
        return n;
    }

    function resolveTeamCount(teamSettings, participantCount) {
        if (teamSettings.splitBy === 'size') {
            const size = Math.max(1, Math.floor(Number(teamSettings.teamSize) || 1));
            return Math.ceil(participantCount / size);
        }
        return Math.floor(Number(teamSettings.teamCount) || 2);
    }

    function strataKey(participant, options) {
        options = options || {};
        const parts = [];
        if (options.balanceGender) parts.push(participant.gender || '_');
        if (options.balanceAbility) parts.push(participant.ability || '_');
        return parts.length > 0 ? parts.join('-') : '_';
    }

    function groupIntoStrata(participants, options) {
        const groups = {};
        participants.forEach(p => {
            const key = strataKey(p, options);
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });
        return groups;
    }

    function distributeTeams(participants, teamCount, options) {
        options = options || {};
        const rng = options.rng || Math.random;
        const teams = [];
        for (let i = 0; i < teamCount; i++) {
            teams.push({ name: `${i + 1}팀`, members: [] });
        }

        const groups = groupIntoStrata(participants, options);
        let teamPointer = 0;
        Object.keys(groups).forEach(key => {
            const shuffled = shuffle(groups[key], rng);
            shuffled.forEach(p => {
                teams[teamPointer % teamCount].members.push({ name: p.name, gender: p.gender, ability: p.ability });
                teamPointer++;
            });
        });

        return teams;
    }

    const api = { shuffle, mapAbilityValue, clampTeamCount, resolveTeamCount, strataKey, groupIntoStrata, distributeTeams };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        global.TeamDrawLogic = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
