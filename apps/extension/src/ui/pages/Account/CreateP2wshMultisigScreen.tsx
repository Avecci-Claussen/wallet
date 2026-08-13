import { useState, type CSSProperties } from 'react';

import { Button, Column, Content, Header, Input, Layout, Text } from '@/ui/components';
import { FooterButtonContainer } from '@/ui/components/FooterButtonContainer';
import { useNavigation, useTools, useWallet } from '@unisat/wallet-state';

export default function CreateP2wshMultisigScreen() {
  const wallet = useWallet();
  const tools = useTools();
  const nav = useNavigation();

  const [mnemonic, setMnemonic] = useState('');
  const [xpubLine, setXpubLine] = useState('');
  const [descriptor, setDescriptor] = useState('');
  const [cosignerText, setCosignerText] = useState('');
  const [k, setK] = useState(2);
  const [preview, setPreview] = useState('');
  const [previewAddress0, setPreviewAddress0] = useState('');
  const [coordinatorAddress0, setCoordinatorAddress0] = useState('');

  const onExport = async () => {
    try {
      const line = await wallet.exportClassicMultisigXpub(mnemonic);
      setXpubLine(line);
      await navigator.clipboard.writeText(line);
      tools.toastSuccess('BIP48 xpub copied — paste it on the org bulletin');
    } catch (e) {
      tools.toastError((e as Error).message);
    }
  };

  const onPreview = async () => {
    try {
      const p = await wallet.previewClassicMultisig({
        mnemonic,
        descriptor: descriptor.trim() || undefined,
        cosignerText: descriptor.trim() ? undefined : cosignerText,
        k
      });
      setPreviewAddress0(p.address0);
      setPreview(
        [`${p.k}-of-${p.n}`, `receive 0: ${p.address0}`, `change 0: ${p.change0}`, '', p.receive].join('\n')
      );
    } catch (e) {
      tools.toastError((e as Error).message);
    }
  };

  const onCreate = async () => {
    try {
      await wallet.createClassicMultisigKeyring({
        mnemonic,
        descriptor: descriptor.trim() || undefined,
        cosignerText: descriptor.trim() ? undefined : cosignerText,
        k,
        coordinatorAddress0
      });
      nav.navigate('MainScreen');
    } catch (e) {
      tools.toastError((e as Error).message);
    }
  };

  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title="P2WSH multisig"
      />
      <Content>
        <Column gap="lg">
          <Text
            size="sm"
            color="textDim"
            wrap
            text="Native SegWit k-of-n (wsh(sortedmulti)), not MuSig2. Switch chain first — Fractal uses the same bc1q/xpub encoding as Bitcoin mainnet. Export your BIP48 xpub to the org bulletin, then import the receive descriptor. Every signer previews address 0, then pastes that published address here. Import refuses a mismatch. Connected sites cannot signPsbt this type."
          />

          <Text text="This signer’s seed (BIP-39)" preset="regular-bold" />
          <Input
            placeholder="12 or 24 words — must be one of the cosigners"
            onChange={(e) => setMnemonic(e.target.value)}
          />
          <Button text="Export BIP48 xpub (copy)" onClick={onExport} />
          {xpubLine ? <Text size="xs" wrap text={xpubLine} /> : null}

          <Text text="Receive descriptor from the bulletin" preset="regular-bold" />
          <textarea
            value={descriptor}
            onChange={(e) => setDescriptor(e.target.value)}
            placeholder="wsh(sortedmulti(2,[deadbeef/48h/0h/0h/2h]xpub…/0/*,…))#checksum"
            style={areaStyle}
          />

          <Text text="Or paste cosigner lines + k" preset="regular-bold" />
          <Input placeholder="k" value={String(k)} onChange={(e) => setK(Number(e.target.value) || 2)} />
          <textarea
            value={cosignerText}
            onChange={(e) => setCosignerText(e.target.value)}
            placeholder={'[fp/48h/0h/0h/2h]xpub…\n[fp/48h/0h/0h/2h]xpub…'}
            style={areaStyle}
          />

          <Button text="Preview address 0" onClick={onPreview} />
          {preview ? <Text size="xs" wrap text={preview} /> : null}

          <Text text="Published receive address 0" preset="regular-bold" />
          <Text
            size="xs"
            color="textDim"
            wrap
            text="Paste the address every signer showed at Preview. Do not type this wallet’s address from memory — copy the shared published string. Import fails if it does not match."
          />
          <Input
            placeholder="tb1q… / bc1q… from the other signers’ Preview"
            onChange={(e) => setCoordinatorAddress0(e.target.value)}
          />
          {previewAddress0 && coordinatorAddress0.trim() && coordinatorAddress0.trim() !== previewAddress0 ? (
            <Text size="xs" color="red" wrap text="Does not match this wallet’s Preview address 0." />
          ) : null}

          <FooterButtonContainer>
            <Button text="Import after published address 0 matches" preset="primary" onClick={onCreate} />
          </FooterButtonContainer>
        </Column>
      </Content>
    </Layout>
  );
}

const areaStyle: CSSProperties = {
  width: '100%',
  minHeight: 88,
  boxSizing: 'border-box',
  padding: 10,
  borderRadius: 8,
  border: '1px solid #333',
  background: '#111',
  color: '#eee',
  fontFamily: 'ui-monospace, monospace',
  fontSize: 11
};
