import prisma from './lib/prisma';
import bcrypt from 'bcryptjs';

const SEED_USERNAME = process.env.SEED_USERNAME || 'harshit';
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'harshit123';
const SEED_NAME = process.env.SEED_NAME || 'Harshit';

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { username: SEED_USERNAME },
    update: {},
    create: {
      username: SEED_USERNAME,
      name: SEED_NAME,
      passwordHash,
      onboardingDone: false
    }
  });

  console.log(`Seeded user: ${user.username} (id: ${user.id})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
