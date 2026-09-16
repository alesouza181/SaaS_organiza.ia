const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsScreen.tsx', 'utf8');

const handleLinkPhoneOriginal = `  const handleLinkPhone = async () => {
    if (!preferences.userPhone || preferences.userPhone.replace(/\\D/g, '').length < 10) {
      alert('Digite um número de telefone válido com DDD.');
      return;
    }
    setIsLinkingPhone(true);
    try {
      await setDoc(doc(db, \`users/\${userId}/preferences\`, 'system'), { userPhone: preferences.userPhone }, { merge: true });
      await setDoc(doc(db, \`users/\${userId}/profile\`, 'data'), { phone: preferences.userPhone }, { merge: true });
      setLinkSuccess(true);
      setTimeout(() => setLinkSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Erro ao vincular número.');
    } finally {
      setIsLinkingPhone(false);
    }
  };`;

const handleLinkPhoneNew = `  const handleLinkPhone = async () => {
    if (!preferences.userPhone || preferences.userPhone.replace(/\\D/g, '').length < 10) {
      alert('Digite um número de telefone válido com DDD.');
      return;
    }
    setIsLinkingPhone(true);
    try {
      await setDoc(doc(db, \`users/\${userId}/preferences\`, 'system'), { userPhone: preferences.userPhone }, { merge: true });
      await setDoc(doc(db, \`users/\${userId}/profile\`, 'data'), { phone: preferences.userPhone }, { merge: true });
      setLinkSuccess(true);
      setTimeout(() => setLinkSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Erro ao vincular número.');
    } finally {
      setIsLinkingPhone(false);
    }
  };

  const handleTestConnection = async () => {
    if (!preferences.userPhone) {
      alert('Vincule um número de telefone primeiro.');
      return;
    }
    setIsTestingConnection(true);
    try {
      // Simulate sending a test message
      const testMessage = preferences.whatsappTemplate
        ? preferences.whatsappTemplate
            .replace('{valor}', '150,00')
            .replace('{data}', new Date().toLocaleDateString('pt-BR'))
            .replace('{categoria}', 'Teste')
        : 'Mensagem de teste do OrganizaIA';
        
      const newLog: Omit<WhatsAppLog, 'id'> = {
        userId,
        date: Timestamp.now(),
        status: 'sent',
        message: testMessage,
        contact: preferences.userPhone
      };
      
      const docRef = await addDoc(collection(db, \`users/\${userId}/whatsapp_logs\`), newLog);
      setWhatsappLogs(prev => [{ id: docRef.id, ...newLog }, ...prev]);
      alert('Teste de conexão enviado com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao testar conexão.');
      
      const errorLog: Omit<WhatsAppLog, 'id'> = {
        userId,
        date: Timestamp.now(),
        status: 'error',
        message: 'Falha ao enviar mensagem de teste.',
        contact: preferences.userPhone || 'Desconhecido'
      };
      const docRef = await addDoc(collection(db, \`users/\${userId}/whatsapp_logs\`), errorLog);
      setWhatsappLogs(prev => [{ id: docRef.id, ...errorLog }, ...prev]);
    } finally {
      setIsTestingConnection(false);
    }
  };`;

content = content.replace(handleLinkPhoneOriginal, handleLinkPhoneNew);
fs.writeFileSync('src/components/SettingsScreen.tsx', content);
