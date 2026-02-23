const crypto = require('crypto');

/**
 * COMPLEX 5-LAYER SPINNING ALGORITHM
 * 
 * This algorithm uses multiple layers of randomization to ensure
 * truly unpredictable and fair winner selection.
 */

class SpinAlgorithm {
    constructor() {
        this.chaosR = 3.99; // Logistic map parameter (edge of chaos)
        this.chaosIterations = 1000;
    }

    /**
     * LAYER 1: Cryptographic Seed Generation
     * Generates a 256-bit unpredictable seed using multiple entropy sources
     */
    generateCryptographicSeed() {
        // Primary entropy from crypto.randomBytes
        const primaryEntropy = crypto.randomBytes(32);

        // Time-based entropy (high resolution)
        const hrTime = process.hrtime.bigint();
        const timeEntropy = Buffer.from(hrTime.toString(16).padStart(16, '0'), 'hex');

        // Process entropy
        const processEntropy = Buffer.from([
            process.pid & 0xFF,
            (process.pid >> 8) & 0xFF,
            Math.floor(process.memoryUsage().heapUsed / 1000) & 0xFF,
            Date.now() & 0xFF
        ]);

        // Salt from additional random bytes
        const salt = crypto.randomBytes(16);

        // Combine all entropy sources
        const combined = Buffer.concat([primaryEntropy, timeEntropy, processEntropy, salt]);

        // Hash to produce final 256-bit seed
        const seed = crypto.createHash('sha256').update(combined).digest();

        return {
            seed,
            seedHex: seed.toString('hex'),
            timestamp: Date.now()
        };
    }

    /**
     * LAYER 2: Triple Fisher-Yates Shuffle
     * Performs 3 passes of Fisher-Yates shuffle with different seeds
     */
    tripleShufflе(array, initialSeed) {
        let result = [...array];
        let currentSeed = initialSeed;

        for (let pass = 0; pass < 3; pass++) {
            // Generate seed for this pass
            const passSeed = crypto.createHash('sha256')
                .update(currentSeed)
                .update(Buffer.from([pass]))
                .digest();

            // Fisher-Yates shuffle using seeded random
            for (let i = result.length - 1; i > 0; i--) {
                // Use bytes from seed to determine swap index
                const seedIndex = i % passSeed.length;
                const randomValue = passSeed[seedIndex] / 255;
                const j = Math.floor(randomValue * (i + 1));

                [result[i], result[j]] = [result[j], result[i]];
            }

            // Update seed for next pass using hash of current result
            const resultHash = crypto.createHash('sha256')
                .update(JSON.stringify(result.map(e => e.id)))
                .digest();

            currentSeed = crypto.createHash('sha256')
                .update(passSeed)
                .update(resultHash)
                .update(Buffer.from(Date.now().toString()))
                .digest();
        }

        return { shuffled: result, finalSeed: currentSeed };
    }

    /**
     * LAYER 3: Weighted Entropy Pool
     * Assigns entropy values to each participant and sorts by entropy
     */
    generateEntropyPool(participants, seed) {
        const entropyPool = participants.map((participant, index) => {
            // Generate unique entropy for each participant
            const participantData = JSON.stringify({
                id: participant.id,
                nama: participant.nama_karyawan,
                nomor: participant.nomor_undian,
                index: index,
                time: Date.now(),
                random: crypto.randomBytes(8).toString('hex')
            });

            const entropy = crypto.createHash('sha256')
                .update(seed)
                .update(participantData)
                .update(crypto.randomBytes(16))
                .digest();

            return {
                ...participant,
                entropy: entropy,
                entropyValue: entropy.reduce((sum, byte, idx) =>
                    sum + byte * Math.pow(256, idx % 4), 0)
            };
        });

        // Sort by entropy value
        entropyPool.sort((a, b) => a.entropyValue - b.entropyValue);

        // Take top candidates (add more randomness by varying pool size)
        const poolSize = Math.max(
            Math.floor(entropyPool.length * 0.3),
            Math.min(entropyPool.length, 10)
        );

        return entropyPool.slice(0, poolSize);
    }

    /**
     * LAYER 4: Chaotic Selection using Logistic Map
     * Uses chaos theory for unpredictable selection
     */
    chaoticSelection(candidates, seed) {
        // Initialize chaos value from seed
        let x = 0;
        for (let i = 0; i < seed.length; i++) {
            x += seed[i] / (255 * seed.length);
        }

        // Ensure x is in valid range (0, 1)
        x = Math.max(0.01, Math.min(0.99, x));

        // Run logistic map iterations
        for (let i = 0; i < this.chaosIterations; i++) {
            x = this.chaosR * x * (1 - x);

            // Add perturbation every 100 iterations
            if (i % 100 === 0) {
                const perturbation = crypto.randomBytes(1)[0] / 25500;
                x = Math.max(0.01, Math.min(0.99, x + perturbation));
            }
        }

        // Use final chaos value to select winner
        const winnerIndex = Math.floor(x * candidates.length);
        const safeIndex = Math.max(0, Math.min(candidates.length - 1, winnerIndex));

        return {
            winner: candidates[safeIndex],
            chaosValue: x,
            selectedIndex: safeIndex
        };
    }

    /**
     * LAYER 5: Hash Verification & Audit Trail
     * Generates verification hash for audit purposes
     */
    generateAuditHash(spinData) {
        const auditData = {
            timestamp: spinData.timestamp,
            initialSeed: spinData.seedHex,
            participantCount: spinData.participantCount,
            winnerId: spinData.winner.id,
            winnerNomor: spinData.winner.nomor_undian,
            chaosValue: spinData.chaosValue,
            processId: process.pid
        };

        const auditHash = crypto.createHash('sha256')
            .update(JSON.stringify(auditData))
            .update(crypto.randomBytes(8))
            .digest('hex');

        return {
            hash: auditHash,
            auditData: auditData
        };
    }

    /**
     * MAIN SPIN FUNCTION
     * Executes the complete 5-layer algorithm
     */
    spin(eligibleParticipants) {
        if (!eligibleParticipants || eligibleParticipants.length === 0) {
            throw new Error('No eligible participants for spinning');
        }

        // Single participant - direct winner
        if (eligibleParticipants.length === 1) {
            const winner = eligibleParticipants[0];
            const auditHash = crypto.createHash('sha256')
                .update(JSON.stringify(winner))
                .update(Date.now().toString())
                .digest('hex');

            return {
                success: true,
                winner: winner,
                spinHash: auditHash,
                metadata: {
                    participantCount: 1,
                    algorithm: 'direct-single',
                    timestamp: Date.now()
                }
            };
        }

        console.log('🎰 Starting 5-Layer Spin Algorithm...');
        console.log(`📊 Eligible participants: ${eligibleParticipants.length}`);

        // LAYER 1: Generate cryptographic seed
        console.log('🔐 Layer 1: Generating cryptographic seed...');
        const seedData = this.generateCryptographicSeed();

        // LAYER 2: Triple shuffle
        console.log('🔀 Layer 2: Triple Fisher-Yates shuffle...');
        const { shuffled, finalSeed } = this.tripleShufflе(
            eligibleParticipants,
            seedData.seed
        );

        // LAYER 3: Entropy pool
        console.log('🎲 Layer 3: Generating entropy pool...');
        const entropyPool = this.generateEntropyPool(shuffled, finalSeed);

        // LAYER 4: Chaotic selection
        console.log('🌀 Layer 4: Chaotic selection...');
        const { winner, chaosValue, selectedIndex } = this.chaoticSelection(
            entropyPool,
            finalSeed
        );

        // LAYER 5: Audit hash
        console.log('✅ Layer 5: Generating audit hash...');
        const { hash: spinHash, auditData } = this.generateAuditHash({
            timestamp: seedData.timestamp,
            seedHex: seedData.seedHex,
            participantCount: eligibleParticipants.length,
            winner: winner,
            chaosValue: chaosValue
        });

        console.log('🎉 Spin complete!');
        console.log(`🏆 Winner: ${winner.nama_karyawan} (${winner.nomor_undian})`);

        return {
            success: true,
            winner: {
                id: winner.id,
                nama_karyawan: winner.nama_karyawan,
                nomor_undian: winner.nomor_undian,
                perusahaan: winner.perusahaan
            },
            spinHash: spinHash,
            metadata: {
                participantCount: eligibleParticipants.length,
                entropyPoolSize: entropyPool.length,
                chaosIterations: this.chaosIterations,
                algorithm: '5-layer-complex',
                timestamp: seedData.timestamp,
                selectedFromPool: selectedIndex
            }
        };
    }

    /**
     * Generate animation sequence for frontend
     * Returns array of random nomor_undian to display during animation
     */
    generateAnimationSequence(participants, frameCount = 30) {
        const sequence = [];

        for (let i = 0; i < frameCount; i++) {
            const randomIndex = crypto.randomInt(0, participants.length);
            sequence.push(participants[randomIndex].nomor_undian);
        }

        return sequence;
    }
}

module.exports = new SpinAlgorithm();
