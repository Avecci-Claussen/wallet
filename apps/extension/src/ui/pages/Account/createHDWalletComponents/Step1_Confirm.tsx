import { useEffect, useMemo, useState } from 'react';

import { Button, Card, Column, Grid, Row, Text } from '@/ui/components';
import { FooterButtonContainer } from '@/ui/components/FooterButtonContainer';
import { ContextData, TabType, UpdateContextDataParams } from '@/ui/pages/Account/createHDWalletComponents/types';
import { colors } from '@/ui/theme/colors';
import { useI18n } from '@unisat/wallet-state';

/** Industry practice: verify a few random positions, not the full phrase (MetaMask / Bitnob / VP0). */
const CHALLENGE_COUNT = 3;
const DISTRACTOR_COUNT = 5;

function cryptoShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let index = arr.length - 1; index > 0; index--) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const swapIndex = random[0]! % (index + 1);
    [arr[index], arr[swapIndex]] = [arr[swapIndex]!, arr[index]!];
  }
  return arr;
}

function pickChallengePositions(wordCount: number, count: number): number[] {
  const all = Array.from({ length: wordCount }, (_, i) => i);
  return cryptoShuffle(all)
    .slice(0, Math.min(count, wordCount))
    .sort((a, b) => a - b);
}

export function Step1_Confirm({
  contextData,
  updateContextData
}: {
  contextData: ContextData;
  updateContextData: (params: UpdateContextDataParams) => void;
}) {
  const { t } = useI18n();
  const words = useMemo(() => contextData.mnemonics.split(' ').filter(Boolean), [contextData.mnemonics]);

  const challenges = useMemo(() => pickChallengePositions(words.length, CHALLENGE_COUNT), [words, contextData.mnemonics]);

  const choices = useMemo(() => {
    if (!words.length || !challenges.length) return [] as number[];
    const challengeSet = new Set(challenges);
    const distractors = cryptoShuffle(Array.from({ length: words.length }, (_, i) => i).filter((i) => !challengeSet.has(i))).slice(
      0,
      DISTRACTOR_COUNT
    );
    return cryptoShuffle([...challenges, ...distractors]);
  }, [words, challenges, contextData.mnemonics]);

  // selectedWordIndex per challenge slot (parallel to challenges[])
  const [selectedIndexes, setSelectedIndexes] = useState<(number | undefined)[]>([]);

  useEffect(() => {
    setSelectedIndexes(challenges.map(() => undefined));
  }, [contextData.mnemonics, challenges]);

  const activeSlot = selectedIndexes.findIndex((v) => v === undefined);

  // Require the exact challenge index (not merely matching word text — duplicates could bypass)
  const hasIncorrectSelection = selectedIndexes.some(
    (wordIndex, slot) => wordIndex !== undefined && wordIndex !== challenges[slot]
  );
  const isVerified =
    selectedIndexes.length === challenges.length &&
    selectedIndexes.every((wordIndex, slot) => wordIndex !== undefined && wordIndex === challenges[slot]) &&
    !hasIncorrectSelection;

  const onSelect = (wordIndex: number) => {
    setSelectedIndexes((current) => {
      // deselect if already chosen
      const existingSlot = current.indexOf(wordIndex);
      if (existingSlot >= 0) {
        const next = [...current];
        next[existingSlot] = undefined;
        return next;
      }
      // block further picks while an incorrect answer is showing
      if (current.some((selectedWordIndex, slot) => selectedWordIndex !== undefined && selectedWordIndex !== challenges[slot])) {
        return current;
      }
      const slot = current.findIndex((v) => v === undefined);
      if (slot < 0) return current;
      const next = [...current];
      next[slot] = wordIndex;
      return next;
    });
  };

  return (
    <Column gap="lg">
      <Text text={t('verify_recovery_phrase')} preset="title-bold" textCenter />
      <Text
        text={t('confirm_backup_by_selecting_words') || 'Select the correct word for each position to confirm your backup.'}
        preset="sub"
        color="textDim"
        textCenter
        style={{ maxWidth: 420, alignSelf: 'center', lineHeight: '18px' }}
      />

      <Grid columns={1} gap="sm" style={{ width: '100%' }}>
        {challenges.map((wordPos, slot) => {
          const selectedWordIndex = selectedIndexes[slot];
          const isIncorrect = selectedWordIndex !== undefined && selectedWordIndex !== wordPos;
          const isSelected = selectedWordIndex !== undefined;
          const isActive = slot === activeSlot;

          return (
            <Card
              key={wordPos}
              preset="style3"
              onClick={
                isIncorrect && selectedWordIndex !== undefined ? () => onSelect(selectedWordIndex) : undefined
              }
              style={{
                minHeight: 44,
                justifyContent: 'flex-start',
                padding: '0 12px',
                gap: 8,
                borderWidth: 1,
                borderColor: isIncorrect
                  ? colors.error
                  : isActive
                    ? 'rgba(227, 187, 95, 0.65)'
                    : isSelected
                      ? 'rgba(227, 187, 95, 0.45)'
                      : colors.border2,
                backgroundColor: isIncorrect
                  ? 'rgba(229, 41, 55, 0.12)'
                  : isSelected
                    ? 'rgba(227, 187, 95, 0.08)'
                    : colors.card
              }}
              data-testid={`mnemonic-confirm-slot-${wordPos}`}>
              <Text
                text={(t('word_number') || 'Word #$1').replace('$1', String(wordPos + 1))}
                size="xs"
                style={{ width: 72 }}
                color={isIncorrect ? 'error' : 'textDim'}
              />
              <Text
                text={selectedWordIndex === undefined ? '...' : words[selectedWordIndex]!}
                size="sm"
                ellipsis
                color={isIncorrect ? 'error' : isSelected ? 'primary' : undefined}
                disableTranslate
              />
            </Card>
          );
        })}
      </Grid>

      <Row justifyCenter fullX>
        <Grid columns={3} gap="sm" style={{ width: '100%' }}>
          {choices.map((wordIndex) => {
            const slotIndex = selectedIndexes.indexOf(wordIndex);
            const isIncorrect = slotIndex >= 0 && wordIndex !== challenges[slotIndex];
            const isSelected = slotIndex >= 0;

            return (
              <Button
                key={wordIndex}
                preset="defaultV2"
                onClick={isSelected && !isIncorrect ? undefined : () => onSelect(wordIndex)}
                style={{
                  minHeight: 40,
                  borderRadius: 6,
                  paddingLeft: 8,
                  paddingRight: 8,
                  borderColor: isIncorrect ? colors.error : isSelected ? 'rgba(227, 187, 95, 0.45)' : colors.border2,
                  backgroundColor: isIncorrect
                    ? 'rgba(229, 41, 55, 0.12)'
                    : isSelected
                      ? 'rgba(227, 187, 95, 0.08)'
                      : '#151313',
                  cursor: isSelected && !isIncorrect ? 'default' : 'pointer'
                }}
                data-testid={`mnemonic-confirm-word-${wordIndex}`}>
                <Text
                  text={words[wordIndex]!}
                  size="sm"
                  color={isIncorrect ? 'error' : isSelected ? 'primary' : undefined}
                  disableTranslate
                  ellipsis
                />
              </Button>
            );
          })}
        </Grid>
      </Row>

      <FooterButtonContainer>
        <Button
          disabled={!isVerified}
          text={t('continue')}
          preset="primary"
          onClick={() =>
            updateContextData({ mnemonics: '', mnemonicVerified: true, tabType: TabType.CHOOSE_ADDRESS_TYPE })
          }
          data-testid="mnemonic-confirm-continue-button"
        />
      </FooterButtonContainer>
    </Column>
  );
}
