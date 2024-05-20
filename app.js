const express = require('express');
const neo4j = require('neo4j-driver');
const path = require('path');

const app = express();
const port = 3000;

// Connect to Neo4j Aura
const driver = neo4j.driver(
  'neo4j+s://14d97dfc.databases.neo4j.io',
  neo4j.auth.basic('neo4j', 'iIyPzS9CH6HwnxIYfOcIdQDuDlQPnTSB7NNwF_kmsS4')
);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/data', async (req, res) => {
  const problemSlug = req.query.problemSlug;

  if (!problemSlug) {
    return res.status(400).json({ error: 'Please enter a problem name.' });
  }

  const session = driver.session();

  try {
    const problemNode = await session.readTransaction(async (tx) => {
      const result = await tx.run(`
        MATCH (p:Problem {name: $problemSlug})
        OPTIONAL MATCH (p)-[r1]->(n1)
        OPTIONAL MATCH (n2)-[r2]->(p)
        OPTIONAL MATCH (p)-[:PRECEDES]->(prec:Problem)
        OPTIONAL MATCH (succ:Problem)-[:PRECEDES]->(p)
        RETURN p, 
               collect(DISTINCT type(r1)) AS outgoingRels, 
               collect(DISTINCT n1) AS outgoingNodes, 
               collect(DISTINCT type(r2)) AS incomingRels, 
               collect(DISTINCT n2) AS incomingNodes,
               collect(DISTINCT prec) AS precedingProblems,
               collect(DISTINCT succ) AS succeedingProblems
      `, { problemSlug });

      if (result.records.length === 0) {
        return null;
      }

      const problemData = result.records[0].get('p').properties;
      const outgoingNodes = result.records[0].get('outgoingNodes').map(node => ({
        name: node.properties.name,
        type: node.labels[0]
      }));
      const outgoingRels = result.records[0].get('outgoingRels');
      const incomingNodes = result.records[0].get('incomingNodes').map(node => ({
        name: node.properties.name,
        type: node.labels[0]
      }));
      const incomingRels = result.records[0].get('incomingRels');
      const precedingProblems = result.records[0].get('precedingProblems').map(node => node.properties);
      const succeedingProblems = result.records[0].get('succeedingProblems').map(node => node.properties);

      return {
        problemName: problemData.name,
        outgoingNodes,
        outgoingRels,
        incomingNodes,
        incomingRels,
        precedingProblems,
        succeedingProblems
      };
    });

    if (!problemNode) {
      return res.status(404).json({ error: 'Problem not found.' });
    }

    res.json(problemNode);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});
app.get('/company-data', async (req, res) => {
  const companyName = req.query.companyName;

  if (!companyName) {
    return res.status(400).json({ error: 'Please enter a company name.' });
  }

  const session = driver.session();

  try {
    const companyData = await session.readTransaction(async (tx) => {
      const result = await tx.run(`
        MATCH (c:Company {name: $companyName})
        OPTIONAL MATCH (c)-[r1]->(n1)
        OPTIONAL MATCH (n2)-[r2]->(c)
        OPTIONAL MATCH (c)<-[:APPLIED_TO]-(student:Student)-[:HIRED_BY]->(otherCompany:Company)
        RETURN c, 
               collect(DISTINCT type(r1)) AS outgoingRels, 
               collect(DISTINCT n1) AS outgoingNodes, 
               collect(DISTINCT type(r2)) AS incomingRels, 
               collect(DISTINCT n2) AS incomingNodes,
               collect(DISTINCT student) AS studentsAppliedAndHired,
               collect(DISTINCT otherCompany) AS companiesWhereStudentsHired
      `, { companyName });

      if (result.records.length === 0) {
        return null;
      }

      const companyNode = result.records[0].get('c').properties;
      const outgoingNodes = result.records[0].get('outgoingNodes').map(node => ({
        name: node.properties.name,
        type: node.labels[0]
      }));
      const outgoingRels = result.records[0].get('outgoingRels');
      const incomingNodes = result.records[0].get('incomingNodes').map(node => ({
        name: node.properties.name,
        type: node.labels[0]
      }));
      const incomingRels = result.records[0].get('incomingRels');
      const studentsAppliedAndHired = result.records[0].get('studentsAppliedAndHired').map(node => node.properties);
      const companiesWhereStudentsHired = result.records[0].get('companiesWhereStudentsHired').map(node => node.properties);

      return {
        companyName: companyNode.name,
        outgoingNodes,
        outgoingRels,
        incomingNodes,
        incomingRels,
        studentsAppliedAndHired,
        companiesWhereStudentsHired
      };
    });

    if (!companyData) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    res.json(companyData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

app.get('/student-data', async (req, res) => {
  const studentName = req.query.studentName;

  if (!studentName) {
    return res.status(400).json({ error: 'Please enter a student name.' });
  }

  const session = driver.session();

  try {
    const studentData = await session.readTransaction(async (tx) => {
      const result = await tx.run(`
        MATCH (s:Student {name: $studentName})
        OPTIONAL MATCH (s)-[r1]->(n1)
        OPTIONAL MATCH (n2)-[r2]->(s)
        OPTIONAL MATCH (s)-[:APPLIED_TO]->(company:Company)
        OPTIONAL MATCH (company)-[:HIRED_BY]->(otherCompany:Company)
        RETURN s, 
               collect(DISTINCT type(r1)) AS outgoingRels, 
               collect(DISTINCT n1) AS outgoingNodes, 
               collect(DISTINCT type(r2)) AS incomingRels, 
               collect(DISTINCT n2) AS incomingNodes,
               collect(DISTINCT company) AS companiesApplied,
               collect(DISTINCT otherCompany) AS companiesWhereHired
      `, { studentName });

      if (result.records.length === 0) {
        return null;
      }

      const studentNode = result.records[0].get('s').properties;
      const outgoingNodes = result.records[0].get('outgoingNodes').map(node => ({
        name: node.properties.name,
        type: node.labels[0]
      }));
      const outgoingRels = result.records[0].get('outgoingRels');
      const incomingNodes = result.records[0].get('incomingNodes').map(node => ({
        name: node.properties.name,
        type: node.labels[0]
      }));
      const incomingRels = result.records[0].get('incomingRels');
      const companiesApplied = result.records[0].get('companiesApplied').map(node => node.properties);
      const companiesWhereHired = result.records[0].get('companiesWhereHired').map(node => node.properties);

      return {
        studentName: studentNode.name,
        outgoingNodes,
        outgoingRels,
        incomingNodes,
        incomingRels,
        companiesApplied,
        companiesWhereHired
      };
    });

    if (!studentData) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    res.json(studentData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
