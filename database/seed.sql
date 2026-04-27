INSERT INTO etats_position(code, libelle)
VALUES
  ('MAGASY', 'En magasin'),
  ('DOTE',   'Dotée')
ON CONFLICT (code) DO NOTHING;

INSERT INTO conditions_techniques(code, libelle)
VALUES
  ('BE',  'Bon état'),
  ('MR',  'Mauvais état répar.'),
  ('MNR', 'Mauvais état irrép.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO provenance_tactique(code, libelle)
VALUES
  ('NORMALE',  'Normale'),
  ('EMPORTEE', 'Emportée'),
  ('RECUPEREE','Récupérée')
ON CONFLICT (code) DO NOTHING;

INSERT INTO sources_dotation(nom, details)
VALUES
  ('Pre-BVDP',     'Dotations antérieures'),
  ('BVDP',         'Dotations BVDP'),
  ('Autre entité', 'Dotations provenant d’autres entités')
ON CONFLICT (nom) DO NOTHING;

WITH types AS (
  INSERT INTO types_arme(nom)
  VALUES
    ('Arme de poing'),
    ('Arme d''épaule'),
    ('Arme collective légère'),
    ('Arme collective lourde'),
    ('Arme à tir courbe'),
    ('Arme légère anti-chars')
  ON CONFLICT (nom) DO NOTHING
  RETURNING id, nom
)
INSERT INTO categories_arme(type_id, nom)
SELECT t.id, cat.nom
FROM types t
JOIN (
  VALUES
    ('Arme de poing','Pistolet automatique (PA)'),
    ('Arme de poing','Revolver'),
    ('Arme d''épaule','Fusil d''assaut'),
    ('Arme d''épaule','Fusil à pompe'),
    ('Arme d''épaule','Fusil de précision'),
    ('Arme d''épaule','Pistolet-mitrailleur'),
    ('Arme collective légère','Fusil mitrailleur (FM)'),
    ('Arme collective lourde','Mitrailleuse 12,7 mm'),
    ('Arme collective lourde','Canon 20 mm'),
    ('Arme collective lourde','Canon 30 mm'),
    ('Arme collective lourde','Canon 40 mm'),
    ('Arme collective lourde','Canon 105 mm'),
    ('Arme collective lourde','Canon 155 mm'),
    ('Arme à tir courbe','Mortier'),
    ('Arme à tir courbe','Lance-roquettes / RPG'),
    ('Arme légère anti-chars','Lance-grenades')
) AS cat(type_nom, nom)
ON (cat.type_nom = t.nom)
ON CONFLICT (type_id, nom) DO NOTHING;

INSERT INTO roles(nom, permissions)
VALUES ('admin', '["role_admin"]')
ON CONFLICT (nom) DO NOTHING;

WITH upsert_admin AS (
  SELECT id FROM utilisateurs WHERE username = 'admin'
)
INSERT INTO utilisateurs(username, password_hash, role_id, roles)
SELECT 'admin',
       crypt('admin123', gen_salt('bf')),
       r.id,
       '[]'
FROM roles r
WHERE r.nom = 'admin'
  AND NOT EXISTS (SELECT 1 FROM upsert_admin)
RETURNING id;

INSERT INTO user_roles(user_id, role_id)
SELECT u.id, r.id
FROM utilisateurs u
JOIN roles r ON r.nom = 'admin'
WHERE u.username = 'admin'
ON CONFLICT DO NOTHING;
