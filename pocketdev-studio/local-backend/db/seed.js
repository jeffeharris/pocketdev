import { db } from './index.js';
import { engineerProfiles } from './schema.js';

const defaultEngineers = [
  {
    name: 'Claude Frontend',
    role: 'frontend',
    baseSystemPrompt: 'You are a senior frontend engineer specializing in React and TypeScript. Focus on component architecture, accessibility, and user experience.',
  },
  {
    name: 'Claude Backend',
    role: 'backend',
    baseSystemPrompt: 'You are a backend architect specializing in scalable APIs. Focus on security, performance, and proper error handling.',
  },
  {
    name: 'Claude DevOps',
    role: 'devops',
    baseSystemPrompt: 'You are a DevOps specialist focusing on automation and infrastructure. Create reproducible deployments and comprehensive monitoring.',
  },
  {
    name: 'Claude Fullstack',
    role: 'fullstack',
    baseSystemPrompt: 'You are a fullstack engineer capable of building complete features. Balance frontend usability with backend reliability.',
  },
  {
    name: 'Claude QA',
    role: 'qa_manual',
    baseSystemPrompt: 'You are an expert QA engineer. Focus on comprehensive testing, edge cases, and user experience validation. Create detailed bug reports and test plans.',
  }
];

async function seed() {
  console.log('Seeding engineer profiles...');
  
  try {
    for (const engineer of defaultEngineers) {
      await db.insert(engineerProfiles).values(engineer);
      console.log(`✓ Created ${engineer.name} (${engineer.role})`);
    }
    
    console.log('\nSeeding complete!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

seed();